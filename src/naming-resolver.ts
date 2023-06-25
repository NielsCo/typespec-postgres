import { Enum, Model, ModelProperty, Namespace, Union } from "@typespec/compiler";
import { postgresReservedKeywords } from "./reserved.js";
import { entityDecoratorString } from "./postgres.js";

type IdentifierType =
    { kind: "Enum", type: Enum }
    | { kind: "Model", type: Model }
    | { kind: "Union", type: Union, modelProperty?: ModelProperty };

type InnerIdentifierType = Enum | Model | Union;

export interface RegisterReturn {
    name: string,
    warning: boolean
}

export function wrapIdentifierType(innerType: InnerIdentifierType, modelProperty?: ModelProperty): IdentifierType {
    switch (innerType.kind) {
        case "Enum":
            return {
                type: innerType,
                kind: innerType.kind
            };
        case "Model":
            return {
                type: innerType,
                kind: innerType.kind
            };
        case "Union":
            return {
                type: innerType,
                kind: innerType.kind,
                modelProperty: modelProperty
            };
    }
}

export class NamingConflictResolver {

    private resolvedNames: Map<InnerIdentifierType | Namespace, string>;

    constructor() {
        this.resolvedNames = new Map<InnerIdentifierType | Namespace, string>();
    }

    public reset() {
        this.resolvedNames = new Map<InnerIdentifierType | Namespace, string>();
    }

    public registerModel(type: IdentifierType, name?: string): boolean {
        /* c8 ignore next 3 */
        if (this.resolvedNames.has(type.type)) {
            return false;
        }

        const entityDecoratorName = this.getNameFromDecorator(type.type);
        if (type.kind === "Model" && type.type.name === "") {
            name = "Anonymous_Model";
        }
        else if (entityDecoratorName) {
            if (isReservedKeyword(entityDecoratorName)) {
                throw new ReservedKeywordError("Reserved Keyword Error", entityDecoratorName);
            }
            name = entityDecoratorName;
        }
        else if (type.kind === "Union") {
            name = this.getIdentifierOfUnionEnum(type.type, type.modelProperty);
        }
        else if (name === undefined) {
            name = type.type.name;
        }

        /* c8 ignore next 3 */
        if (!name) {
            throw Error("empty name");
        }

        const modelForNamespaceAnalysis = type.kind === "Union" ? (type.modelProperty?.model as Model ?? type.type) : type.type;

        const schemaPrefix = this.getSchemaPrefix(modelForNamespaceAnalysis);

        if (entityDecoratorName && this.getKeyWithIdentifier(schemaPrefix + entityDecoratorName)) {
            // only throw the error here if the schema-name also is non-unique
            throw new DuplicateEntityCollisionError(`Entity already defined '${entityDecoratorName}'`, entityDecoratorName);
        }

        const registerReturn = this.generateUniqueName(schemaPrefix + name);

        this.registerName(type.type, registerReturn.name);

        return registerReturn.warning;
    }

    public registerNamespace(namespace: Namespace): boolean {
        /* c8 ignore next 3 */
        if (this.resolvedNames.has(namespace)) {
            return false;
        }
        const originalSchemaName = this.recursivelyGetSchemaNameOfNamespace(namespace);
        const uniqueName = this.generateUniqueName(originalSchemaName);
        this.registerName(namespace, uniqueName.name);
        return uniqueName.warning;
    }

    /**
     * Gets the identifier of a type that is already registered
     * @param type the type to check
     * @returns the identifier of the type
     * @throws an error if the type is not registered
     */
    public getIdentifierOfRegisteredType(type: InnerIdentifierType | Namespace): string {
        if (this.resolvedNames.has(type)) {
            return this.resolvedNames.get(type) as string;
        }
        /* c8 ignore next 2 */
        throw Error("tried to retrieve name that was not registered yet");
    }

    private generateUniqueName(baseName: string, nameCount = 0): RegisterReturn {
        let uniqueName = baseName
            + (nameCount ? '_' + nameCount : '');
        if (isReservedKeyword(uniqueName)) {
            throw new ReservedKeywordError("Reserved Keyword Error " + uniqueName, uniqueName);
        }
        let warning = false;
        const duplicateEntry = this.getKeyWithIdentifier(uniqueName);
        if (duplicateEntry) {
            // there is another entity with the same Identifier
            const duplicateEntityDecoratorName = this.getNameFromDecorator(duplicateEntry);
            if (duplicateEntityDecoratorName) {
                // if it got its name from an entity-decorator we throw an error
                throw new DuplicateEntityCollisionError(`Entity already defined '${uniqueName}'`, duplicateEntityDecoratorName);
            }
            // if not it could be an anonymous model, so we just set a warning
            warning = true;
            const innerCallRet = this.generateUniqueName(baseName, nameCount + 1);
            uniqueName = innerCallRet.name;
            warning = innerCallRet.warning || warning;
        }
        if (uniqueName.length > 63) {
            throw new NameTooLongError(`The entity name '${uniqueName}' is too long`, uniqueName);
        }
        return { name: uniqueName, warning };
    }

    /**
     * gets the key of an identifier. Uses toLowerCase for the comparison and iterates over all entries in the resolvedNames.
     * @param identifier the identifier to check
     * @returns Either an entity or undefined if the identifier is not reserved yet
     */
    private getKeyWithIdentifier(identifier: string): InnerIdentifierType | Namespace | undefined {
        for (const [key, value] of this.resolvedNames.entries()) {
            if (value.toLowerCase() === identifier.toLowerCase()) {
                return key;
            }
        }
        return undefined; // If the target value is not found in the map, return undefined
    }

    private registerName(type: InnerIdentifierType | Namespace, uniqueName: string) {
        this.resolvedNames.set(type, uniqueName);
    }

    private getNameFromDecorator(type: InnerIdentifierType | Namespace): string | undefined {
        const entityDecorator = type.decorators.find(decorator => decorator.decorator.name === entityDecoratorString);
        return (entityDecorator?.args[0]?.value as any)?.value;
    }

    private getIdentifierOfUnionEnum(union: Union, property?: ModelProperty) {
        let name: string;
        if (union.name) {
            name = union.name;
        } else if (property) {
            name = property.name;
            const firstChar = name.charAt(0).toUpperCase();
            const remainingChars = name.slice(1);
            name = firstChar + remainingChars + "Enum";
            let modelName = property.model?.name ?? '';
            const entityDecorator = property.model?.decorators.find(decorator => decorator.decorator.name === entityDecoratorString);
            if (entityDecorator) {
                // the decorator type is not typed well here. But this works
                modelName = (entityDecorator.args[0]?.value as any)?.value ?? modelName;
            }
            name = modelName + name;
        } else { /* c8 ignore next 2 */
            throw new Error ("anonymous union can not be emitted!");
        }
        return name;
    }

    private getSchemaPrefix(type: InnerIdentifierType): string {
        if (type.namespace?.name) {
            const innerReturn = this.getSchemaNameOfNamespace(type.namespace);
            if (innerReturn) {
                return innerReturn + '.';

            } /* c8 ignore next 3 */
            else {
                throw new Error("namespace should be registered BEFORE trying to get the schema prefix of it");
            }
        }
        return '';
    }

    private recursivelyGetSchemaNameOfNamespace(namespace: Namespace): string {
        if (namespace.namespace?.name) {
            return this.recursivelyGetSchemaNameOfNamespace(namespace.namespace) + '_' + namespace.name;
        } else {
            return namespace.name;
        }
    }

    private getSchemaNameOfNamespace(namespace: Namespace): string | undefined {
        if (this.resolvedNames.has(namespace)) {
            return this.resolvedNames.get(namespace) as string;
        }
        /* c8 ignore next 2 */
        return undefined;
    }
}

/**
 * IoC Container Class that holds the reference to the NamingConflictResolver
 */
export class IoCContainer {
    private static instance: IoCContainer;
    private readonly namingConflictResolver: NamingConflictResolver;

    private constructor() {
        this.namingConflictResolver = new NamingConflictResolver();
    }

    public static getInstance(): IoCContainer {
        if (!IoCContainer.instance) {
            IoCContainer.instance = new IoCContainer();
        }
        return IoCContainer.instance;
    }

    public getNamingConflictResolver(): NamingConflictResolver {
        return this.namingConflictResolver;
    }
}

export function isReservedKeyword(name: string): boolean {
    return postgresReservedKeywords.includes(name.toUpperCase());
}

/**
 * Error class that should be thrown if an identifier equals a reserved Keyword in Postgres
 */
export class ReservedKeywordError extends Error {
    constructor(message: string, public errorName: string) {
        super(message);
        this.name = 'ReservedKeywordError';
    }
}

/**
 * Error class that should be thrown if two Entities have the same name (with none of them being anonymous entities)
 */
export class DuplicateEntityCollisionError extends Error {
    constructor(message: string, public errorName: string) {
        super(message);
        this.name = 'DuplicateEntityCollisionError';
    }
}

/**
 * Error class that should be thrown if an entity name is too long
 */
export class NameTooLongError extends Error {
    constructor(message: string, public errorName: string) {
        super(message);
        this.name = 'NameTooLongError';
    }
}