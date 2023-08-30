import { createTypeSpecLibrary, JSONSchemaType, paramMessage } from "@typespec/compiler";

export type FileType = "sql";
export type NewLineType = "crlf" | "lf";
export interface SQLEmitterOptions {
  /**
   * Sets the file type to emit to sql.
   * @default sql, it not specified infer from the `output-file` extension
   */

  "file-type"?: FileType;

  /**
   * Name of the output file.
   * Output file will interpolate the following values:
   *  - service-name: Name of the service if multiple
   *  - version: Version of the service if multiple
   *
   * @default `{service-name}.{version}.tables.sql`
   *
   * @example Single service no versioning
   *  - `tables.sql`
   */
  "output-file"?: string;

  /**
   * Set the newline character for emitting files.
   * @default lf
   */
  "new-line"?: NewLineType;

  /**
   * @default false;
   * Emit non-entity-types
   * By default only types declared as entity with @entity() will be included.
   */
  "emit-non-entity-types"?: boolean;

  /**
   * @default false;
   * Whether to only emit save sql instructions (if exists / if not exists etc.)
   */
  "save-mode"?: boolean
}

const EmitterOptionsSchema: JSONSchemaType<SQLEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "file-type": { type: "string", enum: ["sql"], nullable: true },
    "output-file": { type: "string", nullable: true },
    "new-line": { type: "string", enum: ["crlf", "lf"], default: "lf", nullable: true },
    "emit-non-entity-types": { type: "boolean", nullable: true, default: false },
    "save-mode": { type: "boolean", nullable: true, default: false },
  },
  required: [],
};

const libDefinition = {
  name: "typespec-postgres",
  diagnostics: {
    "references-without-target": {
      severity: "error",
      messages: {
        default: paramMessage`The @references decorator must point to a model but it points to nothing`,
      },
    },
    "reserved-column-name": {
      severity: "error",
      messages: {
        default: paramMessage`Can not create the column '${"type"}' as its name is a reserved keyword in PostgreSQL`,
      },
    },
    "entity-name-too-long": {
      severity: "error",
      messages: {
        default: paramMessage`The name '${"type"}' is too long for a PostgreSQL entity`,
      },
    },
    "invalid-entity-name": {
      severity: "error",
      messages: {
        default: paramMessage`The name '${"type"}' is an invalid name for a PostgreSQL entity`,
      },
    },
    "different-models-referenced": {
      severity: "error",
      messages: {
        default: paramMessage`The @references decorator must point to the same model as the property type but it points to '${"type"}'`,
      },
    },
    "reserved-entity-name": {
      severity: "error",
      messages: {
        default: paramMessage`Can not create the entity '${"type"}' as its name is a reserved keyword in PostgreSQL`,
      },
    },
    "namespace-name-collision": {
      severity: "warning",
      messages: {
        default: paramMessage`The name of the namespace '${"type"}' is colliding with another entity and therefore renamed.`,
      },
    },
    "unsupported-format": {
      severity: "warning",
      messages: {
        default: paramMessage`The format '${"type"}' is not recognized. Only 'UUID' is recognized as a format in the current version`,
      },
    },
    "duplicate-anonymous-name": {
      severity: "warning",
      messages: {
        default: paramMessage`The type '${"type"}' has a collision with another entity. The name may be generated from an anonymous model name`,
      },
    },
    "array-constraints": {
      severity: "warning",
      messages: {
        default: paramMessage`Can not add all decorator-constraints to '${"type"}' because array constraints are not implemented yet`,
      },
    },
    "datatype-not-resolvable": {
      severity: "error",
      messages: {
        default: paramMessage`The datatype of the model property of type '${"type"}' can not be resolved`,
      },
    },
    "composite-key-error": {
      severity: "error",
      messages: {
        default: paramMessage`There was an error in building the composite key type of '${"type"}'`,
      },
    },
    "reference-array": {
      severity: "error",
      messages: {
        default: paramMessage`Can not manually create array references in the property '${"type"}'`,
      },
    },
    "reference-array-has-multiple-key": {
      severity: "error",
      messages: {
        default: paramMessage`Could not create a column from '${"type"}' as part of an many to many relation, because it has a compound key`,
      },
    },
    "reference-array-could-not-create-column": {
      severity: "error",
      messages: {
        default: paramMessage`Could not create a column from '${"type"}' as part of an many to many relation`,
      },
    },
    "reference-array-has-no-key": {
      severity: "error",
      messages: {
        default: paramMessage`Can not create a references to '${"type"}' as part of an many to many relation, because it does not have a @key`,
      },
    },
    "references-has-no-key": {
      severity: "error",
      messages: {
        default: paramMessage`Can not use references to '${"type"}' because it does not have a @key`,
      },
    },
    "references-has-different-type": {
      severity: "error",
      messages: {
        default: paramMessage`Cannot reference the key-type '${"type"}'. The key of a referenced model must have the same type as the referencing property`,
      },
    },
    "unimplemented-enum-type": {
      severity: "error",
      messages: {
        default: paramMessage`Enum Members of the type '${"type"}' are not implemented because they can not be mapped to PostgreSQL enums`,
      },
    },
    "reference-without-key": {
      severity: "error",
      messages: {
        default: paramMessage`Can not reference '${"type"}' automatically because it does not have a @key`,
      },
    },
    "duplicate-entity-identifier": {
      severity: "error",
      messages: {
        default: paramMessage`The entity '${"type"}' is defined twice`,
      },
    },
    "unsupported-type": {
      severity: "error",
      messages: {
        default: paramMessage`The type '${"type"}' is not supported`,
      },
    },
    "not-a-column-type": {
      severity: "error",
      messages: {
        default: paramMessage`The type '${"type"}' is not a property type`,
      },
    },
    "property-is-payload-property": {
      severity: "error",
      messages: {
        default: paramMessage`The property of the type '${"type"}' is a payload entity and is not expected`,
      },
    },
    "reference-not-allowed": {
      severity: "error",
      messages: {
        default: paramMessage`References of the type '${"type"}' are not allowed`,
      },
    },
    "property-not-implemented": {
      severity: "error",
      messages: {
        default: paramMessage`The property of the type '${"type"}' is not implemented yet`,
      },
    },
    "model-type-unexpected": {
      severity: "error",
      messages: {
        default: paramMessage`A model type is not expected here. This is the type: '${"type"}'`,
      },
    },
    "unknown-scalar": {
      severity: "error",
      messages: {
        default: paramMessage`Scalar '${"type"}' is not known.`,
      },
    },
    "union-null": {
      severity: "error",
      messages: {
        default: "Cannot have a union containing only null types.",
      },
    },
    "union-unsupported": {
      severity: "error",
      messages: {
        default: paramMessage`Unions are not supported unless all options are string literals. The Union '${"type"}' can therefore not be emitted`,
        type: paramMessage`Type "${"kind"}" cannot be used in unions`,
        empty:
          "Empty unions are not supported for Postgres - enums must have at least one value.",
        null: "Unions containing multiple model types cannot be emitted to Postgres unless the union is between string and 'null'.",
      },
    },
    "invalid-default": {
      severity: "error",
      messages: {
        default: paramMessage`Invalid type '${"type"}' for a default value`,
      }
    }
  },
  emitter: {
    options: EmitterOptionsSchema as JSONSchemaType<SQLEmitterOptions>,
  },
} as const;

const myLib = createTypeSpecLibrary(libDefinition);
const { reportDiagnostic, createDiagnostic, createStateSymbol } = myLib;

export { myLib, reportDiagnostic, createDiagnostic, createStateSymbol };
