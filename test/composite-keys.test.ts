import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
const pathPrefix = './test/assets/composite-keys/';

describe("Partial Keys", () => {
    it("Should allow simple composite key", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key otherKey: numeric,
                @key myId: numeric
            }
        `);
        const filePath = pathPrefix + "simple-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should allow simple composite key", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key otherKey: numeric,
                @key myId: numeric
            }
        `
        , undefined, { "save-mode": true });
        const filePath = pathPrefix + "save-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it.only("Should allow composite keys of multiple model properties", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key otherKey: numeric,
                @key myId: numeric
            }

            @entity()
            model OtherTest {
                test: Test;
            }
        `);
        const filePath = pathPrefix + "simple-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should not allow cyclic references without keys", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model Test {
                anotherTest: AnotherTest
            }

            @entity()
            model AnotherTest {
                test: Test
            }    
        `);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/reference-without-key",
                message: "Can not reference 'Test' automatically because it does not have a @key",
            },
            {
                code: "typespec-postgres/datatype-not-resolvable",
                message: "The datatype of the model property of type 'Model' can not be resolved",
            },
            {
                code: "typespec-postgres/reference-without-key",
                message: "Can not reference 'AnotherTest' automatically because it does not have a @key",
            },
            {
                code: "typespec-postgres/datatype-not-resolvable",
                message: "The datatype of the model property of type 'Model' can not be resolved",
            },
        ]);
    });
});