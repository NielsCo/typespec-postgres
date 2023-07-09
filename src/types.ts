import { Enum, Model, ModelProperty, Namespace, Type, Union } from "@typespec/compiler";
import { ExternalDocs } from "@typespec/openapi";
import { DirectedGraph } from "./graph.js";
import { NewLineType } from "./lib.js";
import { IoCContainer, wrapIdentifierType } from "./naming-resolver.js";

export type ConstraintType = 'PRIMARY KEY' | 'UNIQUE' | 'CHECK' | 'INLINED FOREIGN KEY' | "DEFAULT" | "NOT NULL";

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
    public type: TType,
    public statement: string,
    public children: Child[] = [],
    public innerProperties: UInnerProperty[] = [], // Default to an empty array
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
    public secondPartOfStatement = '',
    public useSaveMode = false
  ) { super(docs, externalDocs); }

  abstract getIdentifier(): string;

  toString(lineType: NewLineType, saveMode: boolean): string {
    const docs = this.getDocs(lineType);
    const columnsString = this.children.map((column) => column.toString(lineType, saveMode)).join(`,${getNewLine(lineType)}`) + getNewLine(lineType);
    const constraintsString = (this.innerProperties?.length ?? 0) > 0
      ? `,${getNewLine(lineType)}` + this.innerProperties?.map((constraint) => constraint.toString(lineType, saveMode)).join(', ')
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
    public innerProperties: SQLEnumMember[] = [], // Default to an empty array
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
  ) { super(type, "CREATE TYPE", children, innerProperties, docs, externalDocs, " AS ENUM"); }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }
}

export class SQLEnum extends RootLevelSQL<SQLEnumMember, SQLEnumMember, Enum> {
  constructor(
    public type: Enum,
    public children: SQLEnumMember[] = [],
    public innerProperties: SQLEnumMember[] = [], // Default to an empty array
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
    public modelProperty?: ModelProperty,
  ) { super(type, "CREATE TYPE", children, innerProperties, docs, externalDocs, " AS ENUM"); }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }
}

export class SQLTable extends RootLevelSQL<SQLTableColumn, TableConstraint, Model> {
  constructor(
    public type: Model,
    public children: SQLTableColumn[] = [],
    public innerProperties: TableConstraint[] = [], // Default to an empty array
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined,
  ) { super(type, "CREATE TABLE", children, innerProperties, docs, externalDocs, undefined, true); }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }

  getForeignKeyReferences(): SQLTableColumn[] {
    return this.children.filter(column => column.hasForeignKeyConstraint());
  }
}

export class SQLTableColumn extends Documented {
  public columnConstraints: ColumnConstraint[] = [];
  constructor(
    public columnName: string,
    public dataType: SQLColumnType,
    public docs?: string,
    public externalDocs?: ExternalDocs | undefined) {
    super(docs, externalDocs);
    this.columnConstraints = dataType.constraints;
  }
  toString(lineType: NewLineType, saveMode: boolean): string {
    const docs = this.getDocs(lineType);

    this.columnConstraints.sort((a, b) => {
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

    const constraintString = this.columnConstraints.map((constraint) => "" + constraint.toString(lineType, saveMode)).join(' ');
    const dataTypeString = this.dataType.isReference ? this.namingConflictResolver.getIdentifierOfRegisteredType(this.dataType.referencedEntity) : this.dataType.dataTypeString;
    const saveModeString = saveMode ? "ADD COLUMN IF NOT EXISTS " : "";
    const retString = saveModeString + `${this.columnName} ${dataTypeString} ` + (this.dataType.isArray ? '[] ' : '') + constraintString;
    return indentString(docs + inlineStringIfShortEnough(retString), lineType);
  }

  hasForeignKeyConstraint(): boolean {
    return this.columnConstraints.some(constraint => constraint.constraintType === "INLINED FOREIGN KEY");
  }

  getForeignKeyConstraint(): InlinedForeignKeyConstraint | undefined {
    return this.columnConstraints.find(constraint => constraint.constraintType === "INLINED FOREIGN KEY") as InlinedForeignKeyConstraint;
  }

  removeForeignKeyConstraints(): void {
    this.columnConstraints = this.columnConstraints.filter(constraint => constraint.constraintType !== "INLINED FOREIGN KEY");
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

export type TableConstraint = CheckConstraint;

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
  constructor(public type: Namespace) { super(); }
  toString(_lineType: NewLineType, saveMode: boolean): string {
    return `CREATE SCHEMA ` + (saveMode ? "IF NOT EXISTS " : "") + this.getIdentifier() + ";";
  }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }
}

type RootLevelElements = SQLTable | SQLEnum | SQLSchema | SQLEnumFromUnion;

export class SQLRoot extends ToString {
  private rootLevelElements: (RootLevelElements)[];

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
    const references = table.getForeignKeyReferences();
    for (const reference of references) {
      const constraint: InlinedForeignKeyConstraint
        = reference.columnConstraints.find(constraint => constraint.constraintType === "INLINED FOREIGN KEY") as InlinedForeignKeyConstraint;
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
      const referenceColumns = node.getForeignKeyReferences();
      for (const referenceColumn of referenceColumns) {
        const referencedModel = referenceColumn.getForeignKeyConstraint()?.getReferencedModel();
        referenceColumn.removeForeignKeyConstraints();
        if (referencedModel) {
          alterTableStatements.push(new SQLAlterTable(node.getIdentifier(), referenceColumn.columnName, this.namingConflictResolver.getIdentifierOfRegisteredType(referencedModel)));
        } else {
          throw Error("something went wrong in referencing a model");
        }
      }
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
          const alterTableStatement = new SQLAlterTableAddColumns(table.type, [...table.children]);
          table.children = [];
          saveAlterTableStatements.push(alterTableStatement);
        }
      }
      // remove all columns from tables. Then add them to ALTER-TABLE-Statements
    }

    let sortedElements: (SQLEnum | SQLTable | SQLSchema | SQLAlterTable | SQLEnumFromUnion)[] = this.sortRootLevelElements(otherElements);
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

  sqlElementAlreadyExists(elementToCheck: RootLevelElements): boolean {
    return this.rootLevelElements.some(element => element.type === elementToCheck.type);
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
      const warning = this.namingConflictResolver.registerModel(wrapIdentifierType(elementToAdd.type, elementToAdd.modelProperty));
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
      const warning = this.namingConflictResolver.registerModel(wrapIdentifierType(elementToAdd.type));
      this.rootLevelElements.push(elementToAdd);

      return { registered: true, warning, namespaceWarning };
    }
  }
}

export class SQLAlterTableAddColumns extends RootLevelSQL<SQLTableColumn, TableConstraint, Model> {
  constructor(
    public type: Model,
    public children: SQLTableColumn[] = []
  ) {
    super(type, "ALTER TABLE IF EXISTS", children, []);
  }

  getIdentifier(): string {
    return this.namingConflictResolver.getIdentifierOfRegisteredType(this.type);
  }

  getForeignKeyReferences(): SQLTableColumn[] {
    return this.children.filter(column => column.hasForeignKeyConstraint());
  }

  toString(lineType: NewLineType, saveMode: boolean): string {
    const columnsString = this.children.map((column) => column.toString(lineType, saveMode)).join(`,${getNewLine(lineType)}`) + ";";
    const constraintsString = (this.innerProperties?.length ?? 0) > 0
      ? `,${getNewLine(lineType)}` + this.innerProperties?.map((constraint) => constraint.toString(lineType, saveMode)).join(', ')
      : '';

    const statementString = this.statement + (saveMode && this.useSaveMode ? " IF NOT EXISTS" : "");
    const secondPartOfStatementString = (this.secondPartOfStatement ? this.secondPartOfStatement + '' : '');

    const retString = `${statementString} ${this.getIdentifier()}${secondPartOfStatementString}${getNewLine(lineType)}`
      + `${columnsString}${constraintsString}`;
    return inlineStringIfShortEnough(retString);
  }
}

export class SQLAlterTable extends ToString {
  constructor(public tableName: string, public propertyName: string, public referencedTableName: string) { super(); }
  toString(lineType: NewLineType, _saveMode: boolean): string {
    return `ALTER TABLE${getNewLine(lineType)}` + indentString(this.tableName, lineType) + getNewLine(lineType) + `ADD${getNewLine(lineType)}` +
      indentString(`FOREIGN KEY (${this.propertyName}) REFERENCES ${this.referencedTableName};`, lineType);
  }
}

export type VarcharType = `VARCHAR(${`${number}`})`; // This represents the "VARCHAR(any_number)" string

export type SQLColumnReferenceType = {
  isReference: true,
  dataType: "Enum" | "ModelReference",
  referencedEntity: Enum | Union,
  isArray: boolean,
  constraints: ColumnConstraint[],
};
export type SQLStandardColumnType = {
  isReference: false,
  dataType: SQLDataType,
  dataTypeString: SQLDataType | VarcharType,
  isArray: boolean,
  constraints: ColumnConstraint[],
};

export type SQLColumnType = SQLColumnReferenceType | SQLStandardColumnType;

export function isSQLColumnTypeSimilar(a: SQLColumnType, b: SQLColumnType): boolean {
  if (a.isReference !== b.isReference) {
    return false;
  } else if (a.isReference && b.isReference) {
    return a.referencedEntity === b.referencedEntity;
  } else if (a.dataType !== b.dataType) { // only check this here as "ModelReference" and "Enum" can reference the same entity and can be equal here
    return false;
  }
  else if (a.dataType === "Enum" && b.dataType === "Enum") {
    return a.referencedEntity === b.referencedEntity && a.isArray === b.isArray;
  } else if (a.dataType !== "Enum" && b.dataType !== "Enum" && (!a.isReference && !b.isReference)) {
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

