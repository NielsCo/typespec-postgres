import {
  DecoratorApplication,
  EmitContext,
  emitFile,
  Enum,
  EnumMember,
  getDoc,
  getEncode,
  getFormat,
  getMaxLength,
  getMaxValue,
  getMaxValueExclusive,
  getMinLength,
  getMinValue,
  getMinValueExclusive,
  getNamespaceFullName,
  getPropertyType,
  getService,
  interpolatePath,
  IntrinsicScalarName,
  isGlobalNamespace,
  isNumericType,
  isStringType,
  listServices,
  Model,
  ModelProperty,
  Namespace,
  navigateTypesInNamespace,
  NewLine,
  Program,
  ProjectionApplication,
  projectProgram,
  resolvePath,
  Scalar,
  Service,
  Type,
  Union,
  UnionVariant,
  walkPropertiesInherited
} from "@typespec/compiler";
import { createMetadataInfo, MetadataInfo, Visibility, } from "@typespec/http";
import { getExternalDocs, isReadonlyProperty, } from "@typespec/openapi";
import { buildVersionProjections } from "@typespec/versioning";
import { FileType, NewLineType, reportDiagnostic, SQLEmitterOptions } from "./lib.js";

import {
  CheckConstraint,
  ColumnConstraint,
  DefaultConstraint,
  Documented,
  InlinedForeignKeyConstraint,
  isSQLColumnTypeSimilar,
  NotNullConstraint,
  PrimaryKeyConstraint,
  SQLDataType,
  SQLColumnType,
  SQLEnum,
  SQLEnumFromUnion,
  SQLEnumMember,
  SQLRoot,
  SQLTable,
  SQLTableColumn,
  SQLPrimitiveColumnType
} from "./types.js";
import {
  DuplicateEntityCollisionError,
  isReservedKeyword,
  NameTooLongError,
  ReservedKeywordError
} from "./naming-resolver.js";

export const entityDecoratorString = "$entity";
export const referencesDecoratorString = "$references";
export const recordName = "Record"; // the name of a model that is of the type "object"
const arrayName = "Array";
const skippedNamespaces = ['TypeSpec', 'OpenAPI'];
const defaultFileType: FileType = "sql";

const defaultOptions = {
  "new-line": "lf",
  "emit-non-entity-types": false,
} as const;

export async function $onEmit(context: EmitContext<SQLEmitterOptions>) {
  const options = resolveOptions(context);
  const emitter = new SQLEmitter(context.program, options);
  await emitter.emitSQL();
}

export function resolveOptions(
  context: EmitContext<SQLEmitterOptions>
): ResolvedSQLEmitterOptions {
  const resolvedOptions = { ...defaultOptions, ...context.options };

  const fileType =
    resolvedOptions["file-type"] ?? defaultFileType;

  const outputFile =
    resolvedOptions["output-file"] ?? `schema.{service-name}.{version}.${fileType}`;
  return {
    fileType,
    newLine: resolvedOptions["new-line"],
    emitNonEntityTypes: resolvedOptions["emit-non-entity-types"] ?? false,
    outputFile: resolvePath(context.emitterOutputDir, outputFile),
    saveMode: resolvedOptions["save-mode"] ?? false,
  };
}

export interface ResolvedSQLEmitterOptions {
  fileType: FileType;
  outputFile: string;
  newLine: NewLine;
  emitNonEntityTypes: boolean;
  saveMode: boolean;
}

class SQLEmitter {
  private root: SQLRoot;
  metadataInfo: MetadataInfo | undefined;

  constructor(private program: Program, private options: ResolvedSQLEmitterOptions) {
    this.root = new SQLRoot();
  }

  initializeEmitter(_version?: string) {
    this.root = new SQLRoot();
    this.metadataInfo = createMetadataInfo(this.program, {
      canonicalVisibility: Visibility.Read,
      canShareProperty: (p) => isReadonlyProperty(this.program, p),
    });
  }

  async emitSQL() {
    const services = listServices(this.program);
    if (services.length === 0) {
      services.push({ type: this.program.getGlobalNamespaceType() });
    }
    for (const service of services) {
      const commonProjections: ProjectionApplication[] = [
        {
          projectionName: "target",
          arguments: ["json"],
        },
      ];
      const originalProgram = this.program;

      const versions = buildVersionProjections(this.program, service.type);
      for (const record of versions) {
        const projectedProgram = (this.program = projectProgram(originalProgram, [
          ...commonProjections,
          ...record.projections,
        ]));
        const projectedServiceNs: Namespace = projectedProgram.projector.projectedTypes.get(
          service.type
        ) as Namespace;

        await this.emitSQLFromVersion(
          projectedServiceNs === projectedProgram.getGlobalNamespaceType()
            ? { type: projectedProgram.getGlobalNamespaceType() }
            : getService(this.program, projectedServiceNs)!,
          services.length > 1,
          record.version
        );
      }
    }
  }

  resolveOutputFile(service: Service, multipleService: boolean, version?: string): string {
    return interpolatePath(this.options.outputFile, {
      "service-name": multipleService ? getNamespaceFullName(service.type) : undefined,
      version,
    });
  }

  async emitSQLFromVersion(
    service: Service,
    multipleService: boolean,
    version?: string
  ) {
    this.initializeEmitter(version);
    try {
      this.buildSchemaAST(service.type);

      if (!this.program.compilerOptions.noEmit && !this.program.hasError()) {
        await emitFile(this.program, {
          path: this.resolveOutputFile(service, multipleService, version),
          content: serializeAST(this.root, this.options.fileType, this.options.newLine, this.options.saveMode),
          newLine: this.options.newLine,
        });
      }
    } catch (err) {
      /* c8 ignore next 8 */
      if (err instanceof ErrorTypeFoundError) {
        // Return early, there must be a parse error if an ErrorType was
        // inserted into the TypeSpec output
        return;
      } else {
        throw err;
      }
    }
  }

  canTypeBeColumn(type: Type): boolean {
    switch (type.kind) {
      case "String":
        return true;
      case "Number":
        return true;
      case "Boolean":
        return true;
      case "Scalar":
        return true;
      case "Enum":
        return true;
      case "Model":
        return true;
      case "EnumMember":
        return true;
      case "Namespace":
        return false;
      case "Decorator":
        return false;
      case "Object":
        return false;
      case "ModelProperty":
        return this.canTypeBeColumn(type.type);
      case "Union":
        const iterator: IterableIterator<UnionVariant> = type.variants.values();
        return [...iterator].every((item) => item.type.kind === "String");
      case "Intrinsic":
      case "TemplateParameter":
      case "Operation":
      case "Interface":
      case "Tuple":
      case "UnionVariant":
      case "Function":
      case "FunctionParameter":
      case "Projection":
        return false;
    }
  }

  getReferencesDecorator(type: ModelProperty): DecoratorApplication | undefined {
    return type.decorators.find(decorator => decorator.decorator.name === referencesDecoratorString);
  }

  hasEntityDecorator(type: Model | Enum | Union): boolean {
    return type.decorators.some(decorator => decorator.decorator.name === entityDecoratorString);
  }

  getPrimaryKeyPropsOfModel(model: Model): ModelProperty[] {
    // we also have to check all models the referenced model inherits from
    const propArray: ModelProperty[] = [];
    for (const prop of walkPropertiesInherited(model)) {
      if (this.hasKeyDecorator(prop)) {
        propArray.push(prop);
      }
    }
    return propArray;
  }

  /**
     * Returns the data type of the primary key of the model or undefined
     */


  handleDataTypeOfModel(model: Model, modelProperty: ModelProperty): SQLColumnType | undefined {
    let dataType: SQLColumnType | undefined;
    if (model.name === recordName) { // this means we actually have an object here (not anything else)
      dataType = this.getInnerDataTypeOfRecord();
    }
    else if (isModelArray(model)) { // model is an array and not a simple model
      dataType = this.getInnerDataTypeOfArray(model, modelProperty);
    } else {
      this.addModel(model);
      const primaryKeysOfReferencedModel = this.getPrimaryKeyPropsOfModel(model);
      if (primaryKeysOfReferencedModel.length === 0) {
        reportDiagnostic(this.program, {
          code: "reference-without-key",
          format: { type: model.name },
          target: model,
        });
        return undefined;
      } else if (primaryKeysOfReferencedModel.length === 1) {
        dataType = this.getDataTypeOfSinglePrimaryKey(primaryKeysOfReferencedModel[0], model)
      } else {
        // TODO: actually have to add multiple model Properties here!
      }

    }
    return dataType;
  }

  getDataTypeOfSinglePrimaryKey(modelProperty: ModelProperty, referencedModel: Model): SQLColumnType | undefined {
    const referenceDataType = this.getDataTypeOfModelProperty(modelProperty.type, modelProperty);
    if (referenceDataType) {
      if (!referenceDataType.isPrimitive) {
        return {
          typeOriginEntity: referenceDataType.typeOriginEntity,
          isArray: referenceDataType.isArray,
          isPrimitive: false,
          constraints: [],
          dataType: "Enum",
          isForeignKey: true
        };
      } else {
        return {
          dataType: referenceDataType.dataType,
          dataTypeString: referenceDataType?.dataTypeString,
          isArray: referenceDataType?.isArray,
          isPrimitive: true,
          constraints: [new InlinedForeignKeyConstraint(referencedModel)]
        };
      }
    }
    return undefined;
  }

  getDataTypeOfModelProperty(type: Type, modelProperty: ModelProperty, columnName?: string): SQLColumnType | undefined {
    let dataType: SQLColumnType | undefined;
    if (!this.canTypeBeColumn(type)) {
      reportDiagnostic(this.program, {
        code: "not-a-column-type",
        format: { type: type.kind },
        target: type,
      });
      return undefined;
    }

    else if (type.kind === "Enum") {
      this.addEnum(type);
      dataType = { isForeignKey: false, typeOriginEntity: type, isArray: false, isPrimitive: false, constraints: [], dataType: "Enum" };
    }

    else if (type.kind === "Model") {
      dataType = this.handleDataTypeOfModel(type, modelProperty);
    }

    else if (type.kind === "Scalar" && modelProperty) {
      dataType = this.getSQLDataTypeWrapperForScalar(type, modelProperty);
    }

    else if (type.kind === "String" || type.kind === "Number" || type.kind === "Boolean") {
      dataType = this.mapTypeSpecTypeToSQLWrapper(type);
    }

    else if (type.kind === "EnumMember") {
      this.addEnum(type.enum);
      dataType = { isForeignKey: false, typeOriginEntity: type.enum, isArray: false, isPrimitive: false, constraints: [], dataType: "Enum" };
    }

    if (modelProperty && dataType) {
      this.applyIntrinsicDecoratorsToModelProperty(modelProperty, dataType, columnName);
    }

    return dataType;
  }

  applyIntrinsicDecoratorsOfArrays(model: Model, modelProperty: ModelProperty, dataType: SQLColumnType, columnName?: string): { dataType: SQLColumnType, dataTypeThroughParentDecoratorsOverwritten: boolean } {
    let dataTypeThroughParentDecoratorsOverwritten = false;
    const innerType = getInnerTypeOfArray(model);
    if (innerType.kind === "Scalar") {
      const innerReturn = this.applyIntrinsicDecorators(innerType, dataType, false, columnName ?? modelProperty.name);
      if (innerReturn.isPrimitive && dataType.isPrimitive) {
        if (!dataTypeThroughParentDecoratorsOverwritten) {
          dataType.dataTypeString = innerReturn.dataTypeString;
          dataTypeThroughParentDecoratorsOverwritten = dataType.dataTypeString !== innerReturn.dataType;
        }
      } else {
        throw new Error("referenced inner type should either also be enum or not enum");
      }
      // TODO: allow column on array types (must be handled with non-trivial checks!)
      if (innerReturn.constraints.length > 0) {
        reportDiagnostic(this.program, {
          code: "array-constraints",
          format: { type: modelProperty.name },
          target: modelProperty,
        });
        // must be overwritten to [] because of object-references!
        innerReturn.constraints = [];
      }

    }
    return { dataType, dataTypeThroughParentDecoratorsOverwritten };
  }

  applyIntrinsicDecoratorsOfScalar(scalar: Scalar, modelProperty: ModelProperty, dataType: SQLColumnType, columnName?: string): { dataType: SQLColumnType, dataTypeThroughParentDecoratorsOverwritten: boolean } {
    let dataTypeThroughParentDecoratorsOverwritten = false;
    const innerReturn = this.applyIntrinsicDecorators(scalar, dataType, false, columnName ?? modelProperty.name);
    // there are things here that work through object-references being overwritten (so for example the constraints get pushed to the dataType-object)
    if (innerReturn.isPrimitive && dataType.isPrimitive) {
      if (!dataTypeThroughParentDecoratorsOverwritten) {
        dataType.dataTypeString = innerReturn.dataTypeString;
        dataTypeThroughParentDecoratorsOverwritten = dataType.dataTypeString !== innerReturn.dataType;
      }
    } else {
      throw new Error("referenced inner type should either also be enum or not enum");
    }
    return { dataType, dataTypeThroughParentDecoratorsOverwritten };
  }

  applyIntrinsicDecoratorsToModelProperty(modelProperty: ModelProperty, dataType: SQLColumnType, columnName?: string): SQLColumnType {
    let dataTypeThroughParentDecoratorsOverwritten = false;
    if (dataType.isArray && modelProperty.type.kind === "Model" && isModelArray(modelProperty.type)) {
      const model = modelProperty.type;
      ({ dataType, dataTypeThroughParentDecoratorsOverwritten } = this.applyIntrinsicDecoratorsOfArrays(model, modelProperty, dataType, columnName));
    } else if (modelProperty.type.kind === "Scalar") {
      const scalar = modelProperty.type;
      ({ dataType, dataTypeThroughParentDecoratorsOverwritten } = this.applyIntrinsicDecoratorsOfScalar(scalar, modelProperty, dataType, columnName));
    }
    return this.applyIntrinsicDecorators(modelProperty, dataType, dataTypeThroughParentDecoratorsOverwritten);
  }

  applyIntrinsicDecorators(
    modelProperty: Scalar | ModelProperty,
    dataType: SQLColumnType,
    dataTypeThroughParentDecoratorsOverwritten: boolean,
    columnName?: string): SQLColumnType {

    const isString = isStringType(this.program, getPropertyType(modelProperty));
    if (isString && dataType.isPrimitive) {
      dataType = this.applyStringDecorators(modelProperty, dataType, dataTypeThroughParentDecoratorsOverwritten, columnName);
    }

    const isNumeric = isNumericType(this.program, getPropertyType(modelProperty));
    if (isNumeric) {
      dataType = this.applyNumericDecorators(modelProperty, dataType, columnName);
    }

    // TODO: (feature) Add constraints for array types
    // const minItems = getMinItems(this.program, typespecType);
    // if (!target.minItems && minItems !== undefined) {
    //   newTarget.minItems = minItems;
    // }
    // const maxItems = getMaxItems(this.program, typespecType);
    // if (!target.maxItems && maxItems !== undefined) {
    //   newTarget.maxItems = maxItems;
    // }

    // TODO: (feature). Add special handling of passwords
    // if (isSecret(this.program, typespecType)) {
    //   newTarget.format = "password";
    // }

    // FIXME: figure out what known values are!
    // if (isString) {
    //   const values = getKnownValues(this.program, typespecType);
    //   if (values) {
    //     return {
    //       oneOf: [newTarget, getSchemaForEnum(values)],
    //     };
    //   }
    // }

    // TODO: check whether there are more extensions that we should add here!
    // attachExtensions(this.program, typespecType, newTarget);
    return dataType;
  }

  applyNumericDecorators(modelProperty: Scalar | ModelProperty,
    dataType: SQLColumnType,
    columnName?: string): SQLColumnType {
    const minValue = getMinValue(this.program, modelProperty);
    if (minValue !== undefined) {
      const minValueConstraint = new CheckConstraint(`${columnName ?? modelProperty.name} >= ${minValue}`);
      dataType.constraints.push(minValueConstraint);
    }

    const minValueExclusive = getMinValueExclusive(this.program, modelProperty);
    if (minValueExclusive !== undefined) {
      const exclusiveMinValueConstraint = new CheckConstraint(`${columnName ?? modelProperty.name} > ${minValueExclusive}`);
      dataType.constraints.push(exclusiveMinValueConstraint);
    }

    const maxValue = getMaxValue(this.program, modelProperty);
    if (maxValue !== undefined) {
      const maxValueConstraint = new CheckConstraint(`${columnName ?? modelProperty.name} <= ${maxValue}`);
      dataType.constraints.push(maxValueConstraint);
    }

    const maxValueExclusive = getMaxValueExclusive(this.program, modelProperty);
    if (maxValueExclusive !== undefined) {
      const exclusiveMaxValueConstraint = new CheckConstraint(`${columnName ?? modelProperty.name} < ${maxValueExclusive}`);
      dataType.constraints.push(exclusiveMaxValueConstraint);
    }
    return dataType;
  }

  applyStringDecorators(modelProperty: Scalar | ModelProperty,
    dataType: SQLPrimitiveColumnType,
    dataTypeThroughParentDecoratorsOverwritten: boolean,
    columnName?: string): SQLColumnType {

    this.applyMinLength(modelProperty, dataType, columnName);

    this.applyMaxLength(modelProperty, dataType, dataTypeThroughParentDecoratorsOverwritten, columnName);
    // TODO: (feature) Handle patterns
    // const pattern = getPattern(this.program, typespecType);
    // if (isString && !target.pattern && pattern) {
    //   newTarget.pattern = pattern;
    // }

    this.applyFormat(modelProperty, dataType, dataTypeThroughParentDecoratorsOverwritten);
    this.applyEncode(modelProperty, dataType, dataTypeThroughParentDecoratorsOverwritten);

    return dataType;
  }

  applyMinLength(modelProperty: ModelProperty | Scalar, dataType: SQLPrimitiveColumnType, columnName?: string) {
    const minLength = getMinLength(this.program, modelProperty);
    if (minLength) {
      const minLengthConstraint = new CheckConstraint(`LENGTH(${columnName ?? modelProperty.name}) > ${minLength}`);
      dataType.constraints.push(minLengthConstraint);
    }
  }

  applyMaxLength(modelProperty: ModelProperty | Scalar, dataType: SQLPrimitiveColumnType, dataTypeThroughParentDecoratorsOverwritten: boolean, columnName?: string) {
    const maxLength = getMaxLength(this.program, modelProperty);
    if (maxLength) {
      if (dataType.dataTypeString === "TEXT" && maxLength < 10485760) {
        if (!dataTypeThroughParentDecoratorsOverwritten) {
          dataType.dataTypeString = `VARCHAR(${maxLength})`;
        }
      }
      const maxLengthConstraint = new CheckConstraint(`LENGTH(${columnName ?? modelProperty.name}) <= ${maxLength}`);
      dataType.constraints.push(maxLengthConstraint);
    }
  }

  applyEncode(modelProperty: ModelProperty | Scalar, dataType: SQLPrimitiveColumnType, dataTypeThroughParentDecoratorsOverwritten: boolean) {
    const encoding = getEncode(this.program, modelProperty);
    if (encoding?.encoding) {
      if (encoding.encoding.toUpperCase() === "UUID") {
        if (!dataTypeThroughParentDecoratorsOverwritten) {
          dataType.dataTypeString = "UUID";
        }
      } else {
        // TODO: (feature): add more known scalar types if they map to postgres types
        reportDiagnostic(this.program, {
          code: "unsupported-format",
          format: { type: encoding.encoding },
          target: modelProperty,
        });
      }
    }
  }


  /**
   * This method should be deprecated and removed someday as format is replaced by encode!
   */
  applyFormat(modelProperty: ModelProperty | Scalar, dataType: SQLPrimitiveColumnType, dataTypeThroughParentDecoratorsOverwritten: boolean) {
    const formatStr = getFormat(this.program, modelProperty);
    if (formatStr) {
      if (formatStr.toUpperCase() === "UUID") {
        if (!dataTypeThroughParentDecoratorsOverwritten) {
          dataType.dataTypeString = "UUID";
        }
      } else {
        reportDiagnostic(this.program, {
          code: "unsupported-format",
          format: { type: formatStr },
          target: modelProperty,
        });
      }
    }
  }

  getInnerDataTypeOfRecord(): SQLColumnType {
    return { constraints: [], dataType: "JSONB", dataTypeString: "JSONB", isArray: false, isPrimitive: true };
  }

  /**
   * 
   * @param model model type that has the name "Array" and does have an indexer etc.
   * @returns 
   */
  getInnerDataTypeOfArray(model: Model, modelProperty: ModelProperty): SQLColumnType | undefined {
    const indexer = model.indexer;
    if (indexer) {
      const innerType = this.getDataTypeOfModelProperty(indexer.value as unknown as Type, modelProperty);
      if (innerType) {
        innerType.isArray = true;
        if (!innerType.isPrimitive || innerType.constraints.some(constraint => constraint instanceof InlinedForeignKeyConstraint)) {
          reportDiagnostic(this.program, {
            code: "reference-array",
            format: { type: modelProperty.name },
            target: modelProperty,
          });
          return undefined;
        }
      }
      return innerType;
    }
    return undefined;
  }

  // TODO: maybe use this ErrorTypeFoundError to not throw multiple errors at once
  //     if (schema === undefined && isErrorType(type)) {
  //       // Exit early so that syntax errors are exposed.  This error will
  //       // be caught and handled in emitOpenAPI.
  //       throw new ErrorTypeFoundError();
  //     }

  //     TODO: (feature) maybe add the TypeSpec Type to comments?
  //     // helps to read output and correlate to TypeSpec
  //     if (schema) {
  //       schema["x-typespec-name"] = name;
  //     }

  namespaceHasEntities(namespace: Namespace): boolean {
    const possibleEntities = [
      ...namespace.enums.entries(),
      ...namespace.models.entries(),
      ...namespace.unions.entries(),
    ];
    for (const [, possibleEntity] of possibleEntities) {
      if (this.hasEntityDecorator(possibleEntity)) {
        return true;
      }
    }
    for (const [, innerNamespace] of namespace.namespaces.entries()) {
      if (this.namespaceHasEntities(innerNamespace)) {
        return true;
      }
    }
    return false;
  }

  buildSchemaAST(namespace: Namespace) {
    const visitModel = (model: Model) => {
      if (this.options.emitNonEntityTypes || this.hasEntityDecorator(model)) {
        this.addModel(model);
      }
    };
    const visitEnum = (e: Enum) => {
      if (this.options.emitNonEntityTypes || this.hasEntityDecorator(e)) {
        this.addEnum(e);
      }
    };
    const visitUnion = (union: Union) => {
      // only emit unions if they have a name or an entity-decorator
      if ((this.options.emitNonEntityTypes && union.name) || this.hasEntityDecorator(union)) {
        this.addUnion(union);
      }
    };
    const skipSubNamespaces = isGlobalNamespace(this.program, namespace) && !this.namespaceHasEntities(namespace);

    const navigationFunctionWrapper = {
      model: visitModel,
      enum: visitEnum,
      union: visitUnion,
    };

    navigateTypesInNamespace(
      namespace,
      navigationFunctionWrapper,
      { skipSubNamespaces }
    );

    if (this.options.emitNonEntityTypes) {
      this.navigateSubNamespaces(namespace, navigationFunctionWrapper);
    }
  }

  private navigateSubNamespaces(namespace: Namespace, navigationFunctionWrapper: {
    model: (model: Model) => void;
    enum: (e: Enum) => void;
    union: (union: Union) => void;
  }) {
    for (const [, value] of namespace.namespaces) {
      if (skippedNamespaces.every(name => name !== value.name)) {
        navigateTypesInNamespace(
          value,
          navigationFunctionWrapper,
          { skipSubNamespaces: false }
        );
      }
    }
  }

  addUnion(union: Union, property?: ModelProperty): void {

    const iterator: IterableIterator<UnionVariant> = union.variants.values();
    const unionVariantArray = [...iterator];

    for (const unionVariant of unionVariantArray) {
      if (unionVariant.type.kind !== "String") {
        this.reportUnsupportedUnion(union);
        return;
      }
    };

    const options: { kind: string, value: string }[]
      = unionVariantArray.map(unionVariant => unionVariant.type as { kind: string, value: string });

    if (options.length === 0) {
      this.reportUnsupportedUnion(union, "empty");
      return;
    }

    const sqlEnum = new SQLEnumFromUnion(union, property);
    // add the type to root if it exists

    try {
      const registerAnswer = this.root.addEnumFromUnionElement(sqlEnum);
      if (registerAnswer.warning) {
        reportDiagnostic(this.program, {
          code: "duplicate-anonymous-name",
          format: { type: property?.name ?? union.name ?? '' },
          target: property ?? union,
        });
      }
      if (registerAnswer.namespaceWarning) {
        reportDiagnostic(this.program, {
          code: "namespace-name-collision",
          format: { type: property?.model?.namespace?.name ?? union.namespace?.name ?? '' },
          target: property?.model?.namespace as Namespace ?? union.namespace as Namespace,
        });
      }
      if (registerAnswer.registered) {
        this.applyDocs(union, sqlEnum);
        for (const enumMember of options) {
          const sqlEnumMember = new SQLEnumMember(enumMember.value);
          sqlEnum.children.push(sqlEnumMember);
        }
        // if it is added also add the types - otherwise we can skip this
      }
    }
    catch (error) {
      this.handleModelRegisterError(error, union);
    }
  }

  reportUnsupportedUnion(union: Union | Enum, messageId: "default" | "empty" = "default") {
    reportDiagnostic(this.program,
      {
        code: "union-unsupported",
        format: { type: union.name ?? "Anonymous_Union" },
        messageId,
        target: union
      });
  }

  addEnum(e: Enum): void {
    if (e.members.size === 0) {
      this.reportUnsupportedUnion(e, "empty");
      return;
    }

    const sqlEnum = new SQLEnum(e);
    // add the type to root if it exists

    try {
      const registryAnswer = this.root.addElement(sqlEnum);
      if (registryAnswer.warning) {
        reportDiagnostic(this.program, {
          code: "duplicate-anonymous-name",
          format: { type: e.name },
          target: e,
        });
      }
      if (registryAnswer.namespaceWarning) {
        reportDiagnostic(this.program, {
          code: "namespace-name-collision",
          format: { type: e.namespace?.name ?? '' },
          target: e.namespace as Namespace,
        });
      }
      if (registryAnswer.registered) {
        this.applyDocs(e, sqlEnum);
        const type = this.enumMemberType(e.members.values().next().value);
        if (type === undefined) { // break early because the type is not allowed
          return;
        }
        for (const enumMember of e.members.values()) {
          if (type !== this.enumMemberType(enumMember)) {
            this.reportUnsupportedUnion(e);
            continue;
          }

          const value = enumMember.value ?? enumMember.name;
          const sqlEnumMember = new SQLEnumMember(value.toString()); // we cast here because of the check done earlier
          this.applyDocs(enumMember, sqlEnumMember);
          sqlEnum.children.push(sqlEnumMember);
        }
        // if it is added also add the types - otherwise we can skip this
      }
    }
    catch (error) {
      this.handleModelRegisterError(error, e);
    }
  }

  enumMemberType(member: EnumMember): "string" | undefined {
    if (typeof member.value === "number") {
      reportDiagnostic(this.program, {
        code: "unimplemented-enum-type",
        format: { type: "number" },
        target: member,
      });
      return undefined;
    }
    return "string";
  }


  // TODO: (feature) add better handling for unions

  getDefaultValue(type: Type): string | undefined {
    switch (type.kind) {
      case "String":
        return `'${type.value}'`;
      case "Number":
        return type.value.toString();
      case "Boolean":
        return type.value.toString();
      case "Tuple":
        return undefined;
      case "EnumMember":
        const value = type.value ?? type.name;
        return `'${value.toString()}'`;
      default:
        reportDiagnostic(this.program, {
          code: "invalid-default",
          format: { type: type.kind },
          target: type,
        });
        return undefined;
    }
  }

  addModel(model: Model): void {
    const table: SQLTable = new SQLTable(model);
    let gotRegistered = false;
    try {
      const ret = this.root.addElement(table);
      gotRegistered = ret.registered;
      if (ret.warning) {
        reportDiagnostic(this.program, {
          code: "duplicate-anonymous-name",
          format: { type: model.name },
          target: model,
        });
      }
      if (ret.namespaceWarning) {
        reportDiagnostic(this.program, {
          code: "namespace-name-collision",
          format: { type: model.namespace?.name ?? '' },
          target: model.namespace as Namespace,
        });
      }
    }
    catch (error) {
      this.handleModelRegisterError(error, model);
    }

    // TODO: Figure out how to handle discriminators
    // const discriminator = getDiscriminator(this.program, model);
    // if (discriminator) {
    //   const [union] = getDiscriminatedUnion(model, discriminator);

    if (gotRegistered) {

      this.applyDocs(model, table);

      const baseModel = model.baseModel;

      let properties = model.properties.values();
      if (baseModel) {
        properties = walkPropertiesInherited(model);
      }

      for (const prop of properties) {
        this.addPropertyAsColumn(prop, table);
      }
    }
  }

  addPropertyAsColumn(prop: ModelProperty, table: SQLTable) {
    if (!this.metadataInfo!.isPayloadProperty(prop, Visibility.Read)) {
      // should never happen to our entity models anyway.
      reportDiagnostic(this.program, {
        code: "property-is-payload-property",
        format: { type: prop.kind },
        target: prop,
      });
      return;
    }

    if (this.canTypeBeColumn(prop.type)) {
      const dataType: SQLColumnType | undefined = this.getInitialDataTypeOfProperty(prop);

      if (dataType) {
        if (isReservedKeyword(prop.name)) {
          reportDiagnostic(this.program, {
            code: "reserved-column-name",
            format: { type: prop.name },
            target: prop,
          });
          return;
        }
        const column = new SQLTableColumn(prop.name, dataType);
        this.applyDocs(prop, column);

        this.addColumnConstraints(prop, column, table);

        table.children.push(column);
      } else {
        reportDiagnostic(this.program, {
          code: "datatype-not-resolvable",
          format: { type: prop.type.kind },
          target: prop,
        });
      }
    } else {
      reportDiagnostic(this.program, {
        code: "unsupported-type",
        format: { type: prop.type.kind },
        target: prop,
      });
    }
  }

  addColumnConstraints(prop: ModelProperty, column: SQLTableColumn, table: SQLTable) {
    const notNull = !this.metadataInfo!.isOptional(prop, Visibility.All);

    if (notNull) {
      if (this.hasKeyDecorator(prop)) {
        table.primaryKey.push(column);
      } else {
        const notNullConstraint: NotNullConstraint = new NotNullConstraint();
        column.constraints.push(notNullConstraint);
      }
    }

    // FIXME: if the property has an actual value (like for literal-objects): maybe set is as default?

    const referencesDecorator = this.getReferencesDecorator(prop);
    if (referencesDecorator) {
      this.applyReferencesDecorator(referencesDecorator, column.dataType, prop, column);
    }

    if (!column.dataType.isPrimitive && column.dataType.isForeignKey) {
      const referencedModel: Model = prop.type as Model;
      const foreignKeyConstraint: InlinedForeignKeyConstraint = new InlinedForeignKeyConstraint(referencedModel);
      column.constraints.push(foreignKeyConstraint);
    }

    this.setDefaultValues(prop, column);
  }

  setDefaultValues(prop: ModelProperty, column: SQLTableColumn): void {
    if (prop.default) {
      const defaultValue = this.getDefaultValue(prop.default);
      if (defaultValue) {
        const defaultConstraint: DefaultConstraint = new DefaultConstraint(defaultValue);
        column.constraints.push(defaultConstraint);
      }
    }

    if (prop.type.kind === "EnumMember") {
      const defaultValue = this.getDefaultValue(prop.type);
      if (defaultValue) {
        const defaultConstraint: DefaultConstraint = new DefaultConstraint(defaultValue);
        column.constraints.push(defaultConstraint);
      }
    }
  }

  getInitialDataTypeOfProperty(prop: ModelProperty) {
    let dataType: SQLColumnType | undefined;
    if (prop.type.kind === "Union") {
      this.addUnion(prop.type, prop);
      dataType = { isForeignKey: false, typeOriginEntity: prop.type, isArray: false, isPrimitive: false, constraints: [], dataType: "Enum" };
    } else { // for every type except union types with string values
      dataType = this.getDataTypeOfModelProperty(prop.type, prop);
    }
    return dataType;
  }

  applyReferencesDecorator(referencesDecorator: DecoratorApplication, dataType: SQLColumnType, modelProperty: ModelProperty, column: SQLTableColumn) {
    // the decorator type is not typed well here. But this works
    const model: Model = (referencesDecorator.args[0]?.value as any) as Model;
    this.addModel(model);
    const primaryKeys = this.getPrimaryKeyPropsOfModel(model);
    if (primaryKeys.length === 1) {
      const primaryKey = primaryKeys[0];
      const primaryKeyDataType = this.getDataTypeOfModelProperty(model, primaryKey);
      const similar = primaryKeyDataType ? isSQLColumnTypeSimilar(dataType, primaryKeyDataType) : false;
      if (!similar) {
        reportDiagnostic(this.program, {
          code: "references-has-different-type",
          format: { type: primaryKey.type.kind },
          target: modelProperty,
        });
      }
    } else if (primaryKeys.length > 1) {
      // TODO: implement this
    } else {
      reportDiagnostic(this.program, {
        code: "references-has-no-key",
        format: { type: model.name },
        target: modelProperty,
      });
    }
    const foreignKeyConstraint: InlinedForeignKeyConstraint = new InlinedForeignKeyConstraint(model);
    column.constraints.push(foreignKeyConstraint);
  }

  hasKeyDecorator(prop: ModelProperty): boolean {
    return prop.decorators.some(decorator => decorator.decorator.name === "$key");
  }

  handleModelRegisterError(error: unknown, target: Type) {
    if (error instanceof DuplicateEntityCollisionError) {
      reportDiagnostic(this.program, {
        code: "duplicate-entity-identifier",
        format: { type: error.errorName },
        target,
      });
    } else if (error instanceof ReservedKeywordError) {
      reportDiagnostic(this.program, {
        code: "reserved-entity-name",
        format: { type: error.errorName },
        target,
      });
    } else if (error instanceof NameTooLongError) {
      reportDiagnostic(this.program, {
        code: "entity-name-too-long",
        format: { type: error.errorName },
        target,
      });
    }
    else {
      // Re-throw the error if it's not the one we want to handle
      throw error;
    }
  }

  /**
   * applies external and regular docs to a target
   * @param type the type from which to get the docs and external docs from
   * @param target the sql documented target which will emit the docs when they are emitted
   */
  applyDocs(type: Type, target: Documented) {
    // TODO: apply docs if we have an array of a custom-scalar
    // if (dataType?.isArray && type.kind === "ModelProperty" && type.type.kind === "Model") {
    //   const model = type.type;
    //   if (isModelArray(model)) {
    //     const innerType = getInnerTypeOfArray(model);
    //     if (innerType.kind === "Scalar") {
    //       this.applyDocs(innerType, target);
    //     }
    //   }
    // }

    // apply docs if we have a custom-scalar
    if (type.kind === "ModelProperty" && type.type.kind === "Scalar") {
      const scalar = type.type;
      if (!this.program.checker.isStdType(scalar)) { // only do this if we extend another scalar
        this.applyDocs(scalar, target);
      }
    }

    const externalDocs = getExternalDocs(this.program, type);
    if (externalDocs) {
      target.externalDocs = externalDocs;
    }
    const docs = getDoc(this.program, type);
    if (docs) {
      target.docs = docs;
    }
  }

  mapTypeSpecTypeToSQLWrapper(typespecType: Type): SQLColumnType | undefined {
    const innerType = this.mapTypeSpecTypeToSQL(typespecType);
    if (innerType) {
      return {
        dataType: innerType,
        dataTypeString: innerType,
        isArray: false,
        isPrimitive: true,
        constraints: []
      };
    }
    return undefined;
  }

  // Map an TypeSpec type to an SQL Type. Returns undefined when the resulting
  // OAS schema is just a regular object schema.
  mapTypeSpecTypeToSQL(typespecType: Type): SQLDataType | undefined {
    switch (typespecType.kind) {
      case "Number":
        return "DOUBLE PRECISION";
      case "String":
        return "TEXT";
      case "Boolean":
        return "BOOLEAN";
      case "Model":
        reportDiagnostic(this.program, {
          code: "model-type-unexpected",
          format: { type: typespecType.kind },
          target: typespecType,
        });
        return undefined;
    }
    return undefined;
  }

  getSQLDataTypeWrapperForScalar(scalar: Scalar, modelProperty: ModelProperty): SQLColumnType | undefined {
    const innerType = this.getSQLDataTypeForScalar(scalar, modelProperty);
    if (innerType) {
      return innerType;
    } else {
      reportDiagnostic(this.program, {
        code: "unknown-scalar",
        format: { type: scalar.name },
        target: scalar,
      });
    }
    return undefined;
  }

  getSQLDataTypeForScalar(scalar: Scalar, modelProperty: ModelProperty): SQLColumnType | undefined {
    if (this.program.checker.isStdType(scalar)) {
      return this.getDatatypeForStdScalars(scalar, modelProperty);
    } else if (scalar.baseScalar) {
      return this.getSQLDataTypeForScalar(scalar.baseScalar, modelProperty);
    }
    return undefined;
  }

  getLimitConstraint(lowerLimit: string, upperLimit: string, modelProperty: ModelProperty): CheckConstraint {
    return new CheckConstraint(`${modelProperty.name} >= ${lowerLimit} AND ${modelProperty.name} <= ${upperLimit} `);
  }

  getDatatypeForStdScalars(scalar: Scalar & { name: IntrinsicScalarName }, modelProperty: ModelProperty): SQLColumnType | undefined {
    let dataType: SQLDataType;
    const constraints: ColumnConstraint[] = [];
    let lowerLimit: string;
    let upperLimit: string;
    // as there are no unsigned number types in postgres we use checks and types which can hold the values of the unsigned values (also for int8)
    switch (scalar.name) {
      case "bytes":
        dataType = "BYTEA";
        break;
      case "int8": // CHECK (my_int8 >= -128 AND my_int8 <= 127)
        dataType = "SMALLINT";
        lowerLimit = "-128";
        upperLimit = "127";
        constraints.push(this.getLimitConstraint(lowerLimit, upperLimit, modelProperty));
        break;
      case "int16":
        dataType = "SMALLINT";
        break;
      case "int32":
        dataType = "INTEGER";
        break;
      case "int64":
        dataType = "BIGINT";
        break;
      case "safeint":
        dataType = "NUMERIC";
        break;
      case "uint8":
        dataType = "SMALLINT";
        lowerLimit = "0";
        upperLimit = "255";
        constraints.push(this.getLimitConstraint(lowerLimit, upperLimit, modelProperty));
        break;
      case "uint16":
        lowerLimit = "0";
        upperLimit = "65535";
        constraints.push(this.getLimitConstraint(lowerLimit, upperLimit, modelProperty));
        dataType = "INTEGER";
        break;
      case "uint32":
        lowerLimit = "0";
        upperLimit = "4294967295";
        constraints.push(this.getLimitConstraint(lowerLimit, upperLimit, modelProperty));
        dataType = "BIGINT";
        break;
      case "uint64":
        lowerLimit = "0";
        upperLimit = "18446744073709551615";
        constraints.push(this.getLimitConstraint(lowerLimit, upperLimit, modelProperty));
        dataType = "NUMERIC";
        break;
      case "float32":
        dataType = "REAL";
        break;
      case "float64":
        dataType = "DOUBLE PRECISION";
        break;
      case "string":
        dataType = "TEXT";
        break;
      case "boolean":
        dataType = "BOOLEAN";
        break;
      case "plainDate":
        dataType = "DATE";
        break;
      case "utcDateTime":
      case "offsetDateTime":
        dataType = "TIMESTAMP WITH TIME ZONE";
        break;
      case "plainTime":
        dataType = "TIME WITHOUT TIME ZONE";
        break;
      case "duration":
        dataType = "INTERVAL";
        break;
      case "url":
        dataType = "TEXT";
        break;
      case "numeric":
        dataType = "NUMERIC";
        break;
      case "integer":
        dataType = "NUMERIC";
        break;
      case "float":
        dataType = "DOUBLE PRECISION";
        break;
      // FIXME: check https://github.com/microsoft/typespec/issues/1705
      default:
        return undefined;
    }
    return { dataType, constraints, dataTypeString: dataType, isArray: false, isPrimitive: true };
  }
}



class ErrorTypeFoundError extends Error {
  constructor() {
    super("Error type found in evaluated TypeSpec output");
  }
}

function serializeAST(root: SQLRoot, fileType: FileType, newLineType: NewLineType, saveMode: boolean): string {
  if (fileType === "sql") {
    return root.toString(newLineType, saveMode);
  } else {
    return '';
  }
}

export function isModelArray(model: Model): boolean {
  return (model.name === arrayName && !!model.indexer);
}

/**
* Gets the inner type of array
* @param type model type that has the name "Array" and does have an indexer etc.
* @returns
* @throws an Error if the model is not an Array-Type 
*/
export function getInnerTypeOfArray(type: Model): Type {
  const indexer = type.indexer;
  if (indexer) {
    const innerType = indexer.value as unknown as Type;
    if (innerType) {
      return innerType;
    }
  }
  throw Error("cant resolve array type");
}