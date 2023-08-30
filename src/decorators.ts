import { DecoratorContext, Enum, Model, ModelProperty, Type } from "@typespec/compiler";
import { reportDiagnostic } from "./lib.js";
import { isModelArray, recordName, referencesDecoratorString } from "./postgres.js";

export function $entity(context: DecoratorContext, target: (Model | Enum), name?: string) {
  if (name && !isValidPostgreSQLTableName(name)) {
    reportDiagnostic(context.program, {
      code: "invalid-entity-name",
      format: { type: name },
      target: target,
    });
  }
}

export function $references(context: DecoratorContext, target: ModelProperty, element: Model) {
  if (!element) {
    reportDiagnostic(context.program, {
      code: "references-without-target",
      format: { type: target.type.kind },
      target: target,
    });
  }
  else if (!canTypeBeReference(target.type)) {
    reportDiagnostic(context.program, {
      code: "reference-not-allowed",
      format: { type: target.type.kind },
      target: target,
    });
  }
  else if (target.type.kind === "Model" && element) {
    if (target.type === element) {
      // if there is a references decorator on a modelProperty that automatically references the same decorator we delete the decorator
      if (target.decorators.filter(decorator => decorator.decorator.name === referencesDecoratorString).length === 1) {
        target.decorators = target.decorators.filter(decorator => decorator.decorator.name !== referencesDecoratorString);
      }
      else { // should never happen anyway
        throw Error("multiple references decorators an a modelReference");
      }
    } else if (isModelArray(target.type)) {
      // FIXME: new feature: support references-arrays
      // const targetInnerType = getInnerTypeOfArray(target.type);
      
      reportDiagnostic(context.program, {
        code: "reference-array",
        format: { type: target.name },
        target: target,
      });
    } else if (target.type.name !== recordName) { // if the name is "object" it is just a regular object which is allowed
      reportDiagnostic(context.program, {
        code: "different-models-referenced",
        format: { type: element.name },
        target: target,
      });
    }
  }
}

function isValidPostgreSQLTableName(name: string): boolean {
  // Table name should not be empty
  if (!name) return false;

  // Table name should only contain letters, digits, or underscores
  return /^\w+$/.test(name);
}

function canTypeBeReference(type: Type): boolean {
  switch (type.kind) {
    case "String":
      return true; // FIXME: test this in a test!
    case "Number":
      return true;
    case "Model":
      return true;
    case "Scalar":
      return true;
    case "Boolean":
      return true; // This is allowed in postgres, although it's bad design we allow it as well
    case "EnumMember":
      return true; // FIXME: test this in a test!
    case "Intrinsic":
      return false;
    case "Tuple":
      return false;
    case "ModelProperty":
      return false; // FIXME: test this in a test!
    case "Interface":
      return false; // FIXME: test this in a test!
    case "Enum":
      return false;
    case "TemplateParameter":
      return false; // FIXME: test this in a test!
    case "Namespace":
      return false; // FIXME: test this in a test!
    case "Operation":
      return false; // FIXME: test this in a test!
    case "Union":
      return false;
    case "UnionVariant":
      return false; // FIXME: test this in a test!
    case "Function":
      return false; // FIXME: test this in a test!
    case "Decorator":
      return false; // FIXME: test this in a test!
    case "FunctionParameter":
      return false; // FIXME: test this in a test!
    case "Object":
      return false; // FIXME: test this in a test!
    case "Projection":
      return false; // FIXME: test this in a test!
  }
}