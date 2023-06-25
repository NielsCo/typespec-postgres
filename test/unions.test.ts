import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import fs from "fs";
const pathPrefix = './test/assets/unions/';

// test all examples from the TypeSpec playground
describe("unions", () => {
    it("Should recognize Name-Conflict between Union and another Enum", async () => {
        const code = `
        
        @entity()
        model Widget {
            id: string;
            color: "red" | "blue";
        }
    
        @entity()
        enum WidgetColorEnum {
            "green", "blue"
        }
        `;
        const diagnostics = await diagnoseSQLFor(code);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/duplicate-anonymous-name",
                message: "The type 'WidgetColorEnum' has a collision with another entity. The name may be generated from an anonymous model name",
            },
        ]);

        const res = await sqlFor(code, undefined, undefined, true);
        const filePath = pathPrefix + "union-conflict.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should recognize Name-Conflict between multiple unions", async () => {
        const code = `
        @entity()
        model Widget {
            id: string;
            color: "red" | "blue";
            Color: "blue" | "green";
        }
        `;
        const diagnostics = await diagnoseSQLFor(code);
        const res = await sqlFor(code, undefined, undefined, true);
        const filePath = pathPrefix + "anonymous-union-conflict.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);

        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/duplicate-anonymous-name",
                message: "The type 'Color' has a collision with another entity. The name may be generated from an anonymous model name",
            },
        ]);
    });

    it("Unions should be defined within their namespace", async () => {
        const res = await sqlFor(`
        
        @entity()
        model Widget {
            color: "red" | "blue";
        }

        namespace nested {
            @entity()
            model Widget {
                color: "red" | "blue" | "white";
            }
              
        }
    `);
        const filePath = pathPrefix + "unions.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Unions should take the name from entity decorators?", async () => {
        const res = await sqlFor(`
        
        @entity("Test")
        model Widget {
            color: "red" | "blue";
        }
    `);
        const filePath = pathPrefix + "name-unions.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should use the correct name of Named Union-Types", async () => {
        const res = await sqlFor(`
        
        union Breed {
            beagle: "beagle",
            shepherd: "shepard",
            retriever: "GoldenRetriever",
            differentBread: "diff",
        }
        @entity()
        model Dog {
            breed: Breed,
            name: string
        }
    `);
        const filePath = pathPrefix + "named-unions.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should allow to mark a named union as an entity", async () => {
        const res = await sqlFor(`
        
        @entity()
        union Breed {
            beagle: "beagle",
            shepherd: "shepard",
            retriever: "GoldenRetriever",
            differentBread: "diff",
        }
    `);
        const filePath = pathPrefix + "emit-union.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should throw an error for non-string-type unions", async () => {
        const diagnostics = await diagnoseSQLFor(`
        
        @entity()
        union Breed {
            beagle: "beagle",
            other: Other
        }

        model Other {
            name: string,
            otherIdentifier: string
        }
    `);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/union-unsupported",
                message: "Unions are not supported unless all options are string literals. The Union 'Breed' can therefore not be emitted",
            },
        ]);
    });
});