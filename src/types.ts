import { Enum, Model, ModelProperty, Namespace, Type, Union } from "@typespec/compiler";
import { ExternalDocs } from "@typespec/openapi";
import { DirectedGraph } from "./graph.js";
import { NewLineType } from "./lib.js";
import { IoCContainer, ManyToManyIdentifier, wrapIdentifierType } from "./naming-resolver.js";

export type ConstraintType = 'PRIMARY KEY' | 'UNIQUE' | 'CHECK' | 'INLINED FOREIGN KEY' | "DEFAULT" | "NOT NULL" | "COMPOSITE PRIMARY KEY" | "COMPOSITE FOREIGN KEY";

abstract class ToString {
  protected namingConflictResolver;
  constructor() {
    this.namingConflictResolver = IoCContainer.getInstance().getNamingConflictResolver();
  }
  abstract toString(lineType: NewLineType, saveMode: boolean): string;
}

export abstract class Documented extends ToString {
  protected constructor(public docs?: string, public externalDocs?: ExternalDocs | undefined) {
    super();
  }

  getDocs(lineType: NewLineType): string {
    let externalDocsString = '';
    if (this.externalDocs) {
      externalDocsString = `/* ${this.externalDocs.url}` + (this.externalDocs.description ? ', ' + this.externalDocs.description : '') + `*/${getNewLine(lineType)}`;
    }
    const docsString = this.docs ? `/* ${this.docs} */${getNewLine(lineType)}` : '';
    return externalDocsString + docsString;
  }
}

abstract class RootLevelSQL<Child extends ToString, UInnerProperty extends ToString, TType extends Type> extends Documented {
  protected constructor(
    public identifier: RootLevelIdentifier,
    public type: TType,
    public statement: string,
    public children: Child[] = [],
    public constraints: UInnerProperty[] = [],
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
    public secondPartOfStatement = '',
    public useSaveMode = false
  ) { super(docs, externalDocs); }

  abstract getIdentifier(): string;

  toString(lineType: NewLineType, saveMode: boolean): string {
    const docs = this.getDocs(lineType);
    const columnsString = this.children.map((column) => column.toString(lineType, saveMode)).join(`,${getNewLine(lineType)}`) + getNewLine(lineType);
    const constraintsString = (this.constraints?.length ?? 0) > 0
      ? `,${getNewLine(lineType)}` + this.constraints?.map((constraint) => constraint.toString(lineType, saveMode)).join(', ')
      : '';

    const statementString = this.statement + (saveMode && this.useSaveMode ? " IF NOT EXISTS" : "");
    const secondPartOfStatementString = (this.secondPartOfStatement ? this.secondPartOfStatement + '' : '');
    const spacingInNonSaveMode = (saveMode && this.useSaveMode ? "" : " ");

    const retString = `${statementString} ${this.getIdentifier()}${secondPartOfStatementString}${spacingInNonSaveMode}(${getNewLine(lineType)}`
      + `${columnsString}${constraintsString});`;
    return docs + inlineStringIfShortEnough(retString);
  }
}

function indentString(input: string, lineType: NewLineType, indentLevel: number = 2, indentCharacter: string = '  '): string {
  const indentation = indentCharacter.repeat(indentLevel);
  const lines = input.split(getNewLine(lineType));
  const indentedLines = lines.map(line => indentation + line);
  return indentedLines.join(getNewLine(lineType));
}

function inlineStringIfShortEnough(s: string, maxLength: number = 70): string {
  const inlinedString = s
    .replace(/[\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/ ;/g, ';')
    .trim();

  return inlinedString.length <= maxLength ? inlinedString : s;
}

export class SQLEnumMember extends Documented {
  constructor(public value: string, public docs?: string, public externalDocs?: ExternalDocs | undefined) {
    super(docs, externalDocs);
  }

  toString(lineType: NewLineType): string {
    return indentString(this.getDocs(lineType) + `'${this.value}'`, lineType);
  }
}

export class SQLEnumFromUnion extends RootLevelSQL<SQLEnumMember, SQLEnumMember, Union> {
  constructor(
    public type: Union,
    public modelProperty?: ModelProperty,
    public children: SQLEnumMember[] = [],
    public constraints: SQLEnumMember[] = [], // Default to an empty array
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
  ) { super(type, type, "CREATE TYPE", children, constraints, docs, externalDocs, " AS ENUM"); }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }
}

export class SQLEnum extends RootLevelSQL<SQLEnumMember, SQLEnumMember, Enum> {
  constructor(
    public type: Enum,
    public children: SQLEnumMember[] = [],
    public constraints: SQLEnumMember[] = [], // Default to an empty array
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
    public modelProperty?: ModelProperty,
  ) { super(type, type, "CREATE TYPE", children, constraints, docs, externalDocs, " AS ENUM"); }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }
}

export class SQLTable extends RootLevelSQL<SQLTableColumn, TableConstraint, Model> {
  constructor(
    public type: Model,
    public children: SQLTableColumn[] = [],
    public constraints: TableConstraint[] = [], // Default to an empty array
    public primaryKey: SQLTableColumn[] = [],
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
  ) { super(type, type, "CREATE TABLE", children, constraints, docs, externalDocs, undefined, true); }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }

  getColumnsWithForeignKeyReferences(): SQLTableColumn[] {
    return this.children.filter(column => column.hasForeignKeyConstraint());
  }

  toString(lineType: NewLineType, saveMode: boolean): string {
    const docs = this.getDocs(lineType);
    let columnsString = this.children.map((column) => {
      if (this.primaryKey.length === 1 && this.primaryKey.includes(column)) {
        const primaryKeyConstraint: PrimaryKeyConstraint = new PrimaryKeyConstraint();
        column.constraints.push(primaryKeyConstraint);
      }
      return column.toString(lineType, saveMode)
    }
    ).join(`,${getNewLine(lineType)}`);

    if (this.primaryKey.length > 1 && !saveMode) {
      this.constraints.push(new CompositePrimaryKeyConstraint(this.primaryKey))
    }

    let constraintsString = this.constraints?.map((constraint) => indentString(constraint.toString(lineType, saveMode), lineType))
      .join(`,${getNewLine(lineType)}`).concat(getNewLine(lineType));
    if (this.constraints?.length ?? 0) {
      if (this.children.length > 0) {
        columnsString = columnsString + ',' + getNewLine(lineType);
      } else {
        columnsString = columnsString + getNewLine(lineType)
      }
    }

    const statementString = this.statement + (saveMode && this.useSaveMode ? " IF NOT EXISTS" : "");
    const secondPartOfStatementString = (this.secondPartOfStatement ? this.secondPartOfStatement + '' : '');
    const spacingInNonSaveMode = (saveMode && this.useSaveMode ? "" : " ");

    const retString = `${statementString} ${this.getIdentifier()}${secondPartOfStatementString}${spacingInNonSaveMode}(${getNewLine(lineType)}`
      + `${columnsString}${constraintsString});`;
    return docs + inlineStringIfShortEnough(retString);
  }

  hasForeignKeyConstraints(): boolean {
    return this.constraints.some(constraint => constraint.constraintType === "COMPOSITE FOREIGN KEY");
  }

  getForeignKeyConstraints(): CompositeForeignKeyConstraint[] {
    return this.constraints.filter(constraint => constraint.constraintType === "COMPOSITE FOREIGN KEY") as CompositeForeignKeyConstraint[];
  }

  removeForeignKeyConstraints(): void {
    this.constraints = this.constraints.filter(constraint => constraint.constraintType !== "COMPOSITE FOREIGN KEY");
  }
}

export type RootLevelIdentifier = Enum | Union | Model | ModelProperty

export class SQLTableFromManyToMany extends SQLTable {
  constructor(
    public builder: SQLManyToManyBuilder,
    public type: Model,
    public children: SQLTableColumn[] = [],
    public constraints: TableConstraint[] = [], // Default to an empty array
    public primaryKey: SQLTableColumn[] = [],
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
  ) { 
    super(type, children, constraints, primaryKey, docs, externalDocs);
    this.identifier = builder.originalModelProperty;
  }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.builder.originalModelProperty);
  }
}

export class SQLTableColumn extends Documented {
  public constraints: ColumnConstraint[] = [];
  constructor(
    public columnName: string,
    public dataType: SQLColumnType,
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined) {
    super(docs, externalDocs);
    this.constraints = dataType.constraints;
  }
  toString(lineType: NewLineType, saveMode: boolean): string {
    const docs = this.getDocs(lineType);

    this.constraints.sort((a, b) => {
      const aIsInlinedForeignKey = a.constraintType === "INLINED FOREIGN KEY";
      const bIsInlinedForeignKey = b.constraintType === "INLINED FOREIGN KEY";

      if (aIsInlinedForeignKey && !bIsInlinedForeignKey) {
        return 1;
      } else if (!aIsInlinedForeignKey && bIsInlinedForeignKey) {
        return -1;
      } else {
        return 0;
      }
    });

    const constraintString = this.constraints.map((constraint) => "" + constraint.toString(lineType, saveMode)).join(' ');
    const dataTypeString = !this.dataType.isPrimitive ? this.namingConflictResolver.getIdentifierOfRegisteredType(this.dataType.typeOriginEntity) : this.dataType.dataTypeString;
    const saveModeString = saveMode ? "ADD COLUMN IF NOT EXISTS " : "";
    const retString = saveModeString + `${this.columnName} ${dataTypeString} ` + (this.dataType.isArray ? '[] ' : '') + constraintString;
    return indentString(docs + inlineStringIfShortEnough(retString), lineType);
  }

  hasForeignKeyConstraint(): boolean {
    return this.constraints.some(constraint => constraint.constraintType === "INLINED FOREIGN KEY");
  }

  getForeignKeyConstraint(): InlinedForeignKeyConstraint | undefined {
    return this.constraints.find(constraint => constraint.constraintType === "INLINED FOREIGN KEY") as InlinedForeignKeyConstraint;
  }

  removeForeignKeyConstraints(): void {
    this.constraints = this.constraints.filter(constraint => constraint.constraintType !== "INLINED FOREIGN KEY");
  }
}

export interface AddEntityReturn {
  registered: boolean,
  warning: boolean,
  namespaceWarning?: boolean
}

export abstract class SimpleConstraint extends ToString {
  abstract constraintType: ConstraintType;
  abstract constraintString: string;
  toString(_lineType: NewLineType, _saveMode: boolean) {
    return this.constraintString;
  }
}

export type TableConstraint = CheckConstraint | CompositePrimaryKeyConstraint | CompositeForeignKeyConstraint;

export abstract class NamedConstraint extends SimpleConstraint {
  abstract constraintString: string;
  constructor(public name?: string) {
    super();
  }
  toString(lineType: NewLineType, saveMode: boolean): string {
    if (this.name) {
      return `CONSTRAINT ${this.name} ${this.constraintString}`;
    } else {
      return super.toString(lineType, saveMode);
    }
  }
}

export class DefaultConstraint extends SimpleConstraint {
  constraintType: "DEFAULT" = "DEFAULT" as const;
  constraintString = "DEFAULT";
  constructor(public constraintParam: string) {
    super();
    if (!constraintParam) {
      throw Error("DefaultConstraint must have param");
    }
  }
  toString(_lineType: NewLineType, _saveMode: boolean): string {
    return `${this.constraintString} ${this.constraintParam}`;
  }
}

export class CheckConstraint extends SimpleConstraint {
  constraintType: "CHECK" = "CHECK" as const;
  constraintString = "CHECK";
  constructor(public constraintParam: string) {
    if (!constraintParam) {
      throw Error("Check Constraint must have constraintParam");
    }
    super();
  }
  toString(_lineType: NewLineType, _saveMode: boolean): string {
    return `${this.constraintString} (${this.constraintParam})`;
  }
}


export class NotNullConstraint extends SimpleConstraint {
  constraintType: "NOT NULL" = "NOT NULL" as const;
  constraintString: string = "NOT NULL";
}

export class UniqueConstraint extends NamedConstraint {
  constraintType: "UNIQUE" = "UNIQUE" as const;
  constraintString: string = "UNIQUE";
}

export class CompositePrimaryKeyConstraint extends SimpleConstraint {
  constraintType: "COMPOSITE PRIMARY KEY" = "COMPOSITE PRIMARY KEY" as const;
  constraintString: string = "PRIMARY KEY";
  constructor(public keys: SQLTableColumn[]) {
    super();
  }
  toString(_lineType: NewLineType, _saveMode: boolean): string {
    const columnNames: string = this.keys.map(col => col.columnName).join(', ');;
    return _saveMode ? "ADD " + this.constraintString + " (" + columnNames + ")" : this.constraintString + " (" + columnNames + ")"
  }
}

export class CompositeForeignKeyConstraint extends SimpleConstraint {
  constraintType: "COMPOSITE FOREIGN KEY" = "COMPOSITE FOREIGN KEY" as const;
  constraintString: string = "FOREIGN KEY";
  constructor(public keyMembers: SQLTableColumn[], public referencedModel: Model) {
    super();
  }
  toString(_lineType: NewLineType, _saveMode: boolean): string {
    const columnNames: string = this.keyMembers.map(col => col.columnName).join(', ');;
    return _saveMode ? "ADD " + this.constraintString + " (" + columnNames + ")" : this.constraintString + " (" + columnNames + ") REFERENCES " + this.namingConflictResolver.getIdentifierOfRegisteredType(this.referencedModel)
  }
}

export class PrimaryKeyConstraint extends SimpleConstraint {
  constraintType: "PRIMARY KEY" = "PRIMARY KEY" as const;
  constraintString: string = "PRIMARY KEY";
}

export type ColumnConstraint = InlinedForeignKeyConstraint | PrimaryKeyConstraint | UniqueConstraint |
  NotNullConstraint | CheckConstraint | DefaultConstraint;
/**
 * always used the public key if no Property is specified
 */
export class InlinedForeignKeyConstraint extends SimpleConstraint {
  constraintType: "INLINED FOREIGN KEY" = "INLINED FOREIGN KEY" as const;
  constraintString = "REFERENCES";
  constructor(public referencedModel: Model) {
    if (!referencedModel) {
      throw Error("Foreign Key Constraint must have constraintParam");
    }
    super();
  }
  toString(_lineType: NewLineType, _saveMode: boolean): string {
    return `${this.constraintString} ${this.namingConflictResolver.getIdentifierOfRegisteredType(this.referencedModel)}`;
  }
  getReferencedModel(): Model {
    return this.referencedModel;
  }
}

export class SQLSchema extends ToString {
  public identifier: Namespace;
  constructor(public type: Namespace) { 
    super();
    this.identifier = type;
   }
  toString(_lineType: NewLineType, saveMode: boolean): string {
    return `CREATE SCHEMA ` + (saveMode ? "IF NOT EXISTS " : "") + this.getIdentifier() + ";";
  }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }
}

type RootLevelElement = SQLTable | SQLEnum | SQLSchema | SQLEnumFromUnion | SQLTableFromManyToMany;

export class SQLRoot extends ToString {
  private rootLevelElements: (RootLevelElement)[];

  constructor() {
    super();
    this.rootLevelElements = [];
    this.namingConflictResolver.reset();
  }

  private addTablesToGraph(tables: SQLTable[], graph: DirectedGraph<SQLTable>) {
    for (const table of tables) {
      graph.addNode(table);
    }

    for (const table of tables) {
      this.addReferencesToGraph(table, graph);
    }
  }

  private addReferencesToGraph(table: SQLTable, graph: DirectedGraph<SQLTable>) {
    const inlinedReferences = table.getColumnsWithForeignKeyReferences();
    for (const reference of inlinedReferences) {
      const constraint: InlinedForeignKeyConstraint
        = reference.constraints.find(constraint => constraint.constraintType === "INLINED FOREIGN KEY") as InlinedForeignKeyConstraint;
      if (constraint) {
        const referencedModel = constraint.getReferencedModel();
        const referencedElement = this.getRootLevelElementForType(referencedModel);
        if (!(referencedElement && referencedElement instanceof SQLTable)) {
          throw Error("Did not find the referenced SQLTable to a reference! " + (referencedModel.name ?? ''));
        } else {
          graph.addEdge(table, referencedElement);
        }
      }
    }
    const compositeReferences = table.getForeignKeyConstraints()
    for (const reference of compositeReferences) {
      const referencedElement = this.getRootLevelElementForType(reference.referencedModel);
      if (!(referencedElement && referencedElement instanceof SQLTable)) {
        throw Error("Did not find the referenced SQLTable to a reference! " + (reference.referencedModel.name ?? ''));
      } else {
        graph.addEdge(table, referencedElement);
      }
    }
  }

  private sortTablesByReferenceHierarchy(tables: SQLTable[]): { tables: SQLTable[], alterTableStatements: SQLAlterTable[] } {
    const graph = new DirectedGraph<SQLTable>;
    this.addTablesToGraph(tables, graph);
    let alterTableStatements: SQLAlterTable[] = [];
    if (graph.getEdges().length !== 0) { // Only sort if we have references
      const cycleNodes = graph.getNodesInCycles();
      if (cycleNodes.length > 0) {
        ({ tables, alterTableStatements } = this.handleCyclesInGraph(graph, cycleNodes));
      } else {
        tables = graph.referenceHierarchySort();
      }
    }
    return { tables, alterTableStatements };
  }

  private handleCyclesInGraph(graph: DirectedGraph<SQLTable>, cycleNodes: SQLTable[]): { tables: SQLTable[], alterTableStatements: SQLAlterTable[] } {
    const alterTableStatements: SQLAlterTable[] = [];
    const tables = [];
    for (const node of cycleNodes) {
      // get the references and move them to ALTER-Table constraints
      const referenceColumns = node.getColumnsWithForeignKeyReferences();
      for (const referenceColumn of referenceColumns) {
        const referencedModel = referenceColumn.getForeignKeyConstraint()?.getReferencedModel();
        referenceColumn.removeForeignKeyConstraints();
        if (referencedModel) {
          alterTableStatements.push(new SQLAlterTable(node.getIdentifier(), [referenceColumn.columnName], this.namingConflictResolver.getIdentifierOfRegisteredType(referencedModel)));
        } else {
          throw Error("something went wrong in referencing a model");
        }
      }
      const compositeKeyReferences = node.getForeignKeyConstraints();
      for (const compositeKeyReference of compositeKeyReferences) {
        alterTableStatements.push(new SQLAlterTable(node.getIdentifier(), compositeKeyReference.keyMembers.map(member => member.columnName), this.namingConflictResolver.getIdentifierOfRegisteredType(compositeKeyReference.referencedModel)));
      }
      node.removeForeignKeyConstraints();
      tables.push(node);
      graph.removeNode(node);
    }
    if (graph.getNodesInCycles().length > 0) {
      throw Error("could not remove all cycles in graph...");
    }
    tables.push(...graph.referenceHierarchySort());
    return { tables, alterTableStatements };
  }

  toString(lineType: NewLineType, saveMode = false): string {
    let tables: SQLTable[] = this.rootLevelElements.filter(element => element instanceof SQLTable) as SQLTable[];
    const otherElements = this.rootLevelElements.filter(element => !(element instanceof SQLTable));
    let alterTableStatements: SQLAlterTable[] = [];
    const saveAlterTableStatements: SQLAlterTableAddColumns[] = [];

    ({ tables, alterTableStatements } = this.sortTablesByReferenceHierarchy(tables));

    if (saveMode) {
      for (const table of tables) {
        if (table.children.length > 0) { // TODO: check whether we actually need this (with a test!)
          const alterTableStatement = new SQLAlterTableAddColumns(table.type, [...table.children], table.primaryKey);
          table.children = [];
          saveAlterTableStatements.push(alterTableStatement);
        }
      }
      // remove all columns from tables. Then add them to ALTER-TABLE-Statements
    }

    let sortedElements: (SQLEnum | SQLTable | SQLSchema | SQLAlterTable | SQLEnumFromUnion | SQLAlterTableAddColumns)[] = this.sortRootLevelElements(otherElements);
    sortedElements = sortedElements.concat(...tables);
    sortedElements = sortedElements.concat(...saveAlterTableStatements).concat(...alterTableStatements);
    return sortedElements.map(rootLevelElement => rootLevelElement.toString(lineType, saveMode)).join(getNewLine(lineType, 2));
  }

  private sortRootLevelElements(elements: (SQLEnum | SQLTable | SQLSchema | SQLEnumFromUnion)[]) {
    return elements.sort((a, b) => {
      if (a.type.kind === "Namespace" && b.type.kind === "Namespace") {
        return 0;
      } else if (a.type.kind === "Namespace") {
        return -1;
      } else if (b.type.kind === "Namespace") {
        return 1;
      } else if (a.type.kind === "Enum" && b.type.kind === "Enum") {
        return 0;
      } else if (a.type.kind === "Enum") {
        return -1;
      } else if (b.type.kind === "Enum") {
        return 1;
      } else {
        return 0;
      }
    });
  }

  getIdentifierOfType(type: Model | Enum): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(type);
  }

  getRootLevelElementForType(type: Model | Enum) {
    return this.rootLevelElements.find(element => element.type === type);
  }

  sqlElementAlreadyExists(elementToCheck: RootLevelElement): boolean {
    return this.rootLevelElements.some(element => element.identifier === elementToCheck.identifier);
  }

  private addNamespace(namespace: Namespace): boolean {
    const sqlSchema = new SQLSchema(namespace);
    if (!this.sqlElementAlreadyExists(sqlSchema)) {
      const warning = this.namingConflictResolver.registerNamespace(namespace);
      this.rootLevelElements.push(sqlSchema);
      return warning;
    }
    return false;
  }

  addEnumFromUnionElement(elementToAdd: SQLEnumFromUnion): AddEntityReturn {
    if (this.sqlElementAlreadyExists(elementToAdd)) {
      return { registered: false, warning: false, namespaceWarning: false };
    }
    else {
      // first register the namespace
      let namespaceWarning = false;
      const namespace = elementToAdd.type.namespace;
      if (namespace?.name) {
        namespaceWarning = this.addNamespace(namespace);
      }
      // then register the model
      const warning = this.namingConflictResolver.registerType(wrapIdentifierType(elementToAdd.type, elementToAdd.modelProperty));
      this.rootLevelElements.push(elementToAdd);

      return { registered: true, warning, namespaceWarning };
    }
  }

  addManyToManyTable(elementToAdd: SQLTableFromManyToMany) {
    if (this.sqlElementAlreadyExists(elementToAdd)) {
      return { registered: false, warning: false, namespaceWarning: false };
    }
    else {
      // first register the namespace
      let namespaceWarning = false;
      const namespace = elementToAdd.type.namespace;
      if (namespace?.name) {
        namespaceWarning = this.addNamespace(namespace);
      }
      // then register the modelProperty

      const manyToManyIdentifier: ManyToManyIdentifier = {
        kind: "ManyToManyIdentifier",
        originalModel: elementToAdd.builder.originalModel,
        referencedModel: elementToAdd.builder.referencedModel,
        type: elementToAdd.builder.originalModelProperty
      }

      const warning = this.namingConflictResolver.registerType(manyToManyIdentifier);
      this.rootLevelElements.push(elementToAdd);

      return { registered: true, warning, namespaceWarning };
    }
  }

  addElement(elementToAdd: SQLTable | SQLEnum): AddEntityReturn {
    if (this.sqlElementAlreadyExists(elementToAdd)) {
      return { registered: false, warning: false, namespaceWarning: false };
    }
    else {
      // first register the namespace
      let namespaceWarning = false;
      const namespace = elementToAdd.type.namespace;
      if (namespace?.name) {
        namespaceWarning = this.addNamespace(namespace);
      }
      // then register the model
      const warning = this.namingConflictResolver.registerType(wrapIdentifierType(elementToAdd.type));
      this.rootLevelElements.push(elementToAdd);

      return { registered: true, warning, namespaceWarning };
    }
  }
}

export class SQLAlterTableAddColumns extends RootLevelSQL<SQLTableColumn, TableConstraint, Model> {
  constructor(
    public type: Model,
    public children: SQLTableColumn[] = [],
    public primaryKey: SQLTableColumn[] = []
  ) {
    super(type, type, "ALTER TABLE IF EXISTS", children, []);
  }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }

  getForeignKeyReferences(): SQLTableColumn[] {
    return this.children.filter(column => column.hasForeignKeyConstraint());
  }

  toString(lineType: NewLineType, saveMode: boolean): string {
    let columnsString = this.children.map((column) => {
      if (this.primaryKey.length === 1 && this.primaryKey.includes(column)) {
        const primaryKeyConstraint: PrimaryKeyConstraint = new PrimaryKeyConstraint();
        column.constraints.push(primaryKeyConstraint);
      }
      return column.toString(lineType, saveMode)
    }).join(`,${getNewLine(lineType)}`);

    if (this.primaryKey.length > 1) {
      this.constraints.push(new CompositePrimaryKeyConstraint(this.primaryKey))
    }

    let constraintsString = this.constraints?.map((constraint) => indentString(constraint.toString(lineType, saveMode), lineType))
      .join(`,${getNewLine(lineType)}`);
    if (this.constraints?.length ?? 0) {
      if (this.children.length > 0) {
        columnsString = columnsString + ',' + getNewLine(lineType);
      } else {
        columnsString = columnsString + getNewLine(lineType)
      }
    }
    const statementString = this.statement + (saveMode && this.useSaveMode ? " IF NOT EXISTS" : "");
    const secondPartOfStatementString = (this.secondPartOfStatement ? this.secondPartOfStatement + '' : '');

    const retString = `${statementString} ${this.getIdentifier()}${secondPartOfStatementString}${getNewLine(lineType)}`
      + `${columnsString}${constraintsString}` + ";";
    return inlineStringIfShortEnough(retString);
  }
}

export class SQLAlterTable extends ToString {
  constructor(public tableName: string, public propertyNames: string[], public referencedTableName: string) { super(); }
  toString(lineType: NewLineType, _saveMode: boolean): string {
    const valueInBrackets = this.propertyNames.length === 1 ? this.propertyNames[0] : this.propertyNames.join(", ");
    return `ALTER TABLE${getNewLine(lineType)}` + indentString(this.tableName, lineType) + getNewLine(lineType) + `ADD${getNewLine(lineType)}` +
      indentString(`FOREIGN KEY (${valueInBrackets}) REFERENCES ${this.referencedTableName};`, lineType);
  }
}

export type VarcharType = `VARCHAR(${`${number}`})`; // This represents the "VARCHAR(any_number)" string

export type SQLColumnType = SQLNonPrimitiveColumnType | SQLPrimitiveColumnType ;

export type SQLManyToManyBuilder = {
  isPrimitive: false,
  referencedModel: Model,
  originalModel: Model,
  isBuilder: true,
  dataType: undefined,
  isCompositeKey: false,
  originalModelProperty: ModelProperty,
}

export type SQLNonPrimitiveColumnType = {
  isPrimitive: false,
  dataType: "Enum"
  isForeignKey: boolean,
  typeOriginEntity: Enum | Union, // entity that defines the SQL-Type.
  isArray: boolean,
  constraints: ColumnConstraint[],
  isCompositeKey: false,
  isBuilder: false,
};
export type SQLPrimitiveColumnType = {
  isPrimitive: true,
  dataType: SQLDataType,
  dataTypeString: SQLDataType | VarcharType,
  isArray: boolean,
  constraints: ColumnConstraint[],
  isCompositeKey: false;
  isBuilder: false,
};

export type SQLCompositeKey = {
  tuples: ModelPropertyColumnTypeTuple[],
  isCompositeKey: true,
  referencedModel: Model,
  compositeKeyModelProperty: ModelProperty,
  isBuilder: false,
}

export type ModelPropertyColumnTypeTuple = {
  modelProperty: ModelProperty,
  dataType: SQLColumnType | undefined | SQLCompositeKey,
}

export function isSQLColumnTypeSimilar(a: SQLColumnType, b: SQLColumnType): boolean {
  if (a.isBuilder || b.isBuilder) {
    return false; // TODO: check whether sometimes this isn't the case
  }
  if (a.isPrimitive !== b.isPrimitive) {
    return false;
  } else if (!a.isPrimitive && !b.isPrimitive) {
    return a.typeOriginEntity === b.typeOriginEntity;
  } else if (a.dataType !== b.dataType) { // only check this here as "ModelReference" and "Enum" can reference the same entity and can be equal here
    return false;
  }
  else if (a.dataType === "Enum" && b.dataType === "Enum") {
    return a.typeOriginEntity === b.typeOriginEntity && a.isArray === b.isArray;
  } else if (a.dataType !== "Enum" && b.dataType !== "Enum" && (a.isPrimitive && b.isPrimitive)) {
    return a.dataTypeString === b.dataTypeString && a.isArray === b.isArray;
  }
  return false;
}

function getNewLine(lineType: NewLineType, amount = 1) {
  let newLineString;
  switch (lineType) {
    case "lf":
      newLineString = "\n";
      break;
    case "crlf":
      newLineString = "\r\n";
      break;
  }
  return newLineString.repeat(amount);
}

export type SQLDataType =
  | 'SMALLINT'
  | 'INTEGER'
  | 'BIGINT'
  | 'DECIMAL'
  | 'NUMERIC'
  | 'REAL'
  | 'DOUBLE PRECISION'
  | 'SMALLSERIAL'
  | 'SERIAL'
  | 'BIGSERIAL'
  | 'MONEY'
  | 'CHAR'
  | 'VARCHAR'
  | 'TEXT'
  | 'BYTEA'
  | 'TIMESTAMP'
  | 'TIMESTAMP WITH TIME ZONE'
  | 'DATE'
  | 'TIME'
  | 'TIME WITH TIME ZONE'
  | 'INTERVAL'
  | 'BOOLEAN'
  | 'POINT'
  | 'LINE'
  | 'LSEG'
  | 'BOX'
  | 'PATH'
  | 'POLYGON'
  | 'CIRCLE'
  | 'CIDR'
  | 'INET'
  | 'MACADDR'
  | 'MACADDR8'
  | 'BIT'
  | 'BIT VARYING'
  | 'UUID'
  | 'JSON'
  | 'JSONB'
  | 'ARRAY'
  | 'RANGE'
  | 'DOMAIN'
  | 'USER-DEFINED'
  | 'TIME WITHOUT TIME ZONE';

