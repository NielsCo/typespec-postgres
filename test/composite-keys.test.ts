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

    it("Should allow composite keys of multiple model properties", async () => {
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
        const filePath = pathPrefix + "automatic-reference-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should hoist when composite-keys exist", async () => {
        const res = await sqlFor(`
            @entity()
            model OtherTest {
                test: Test;
            }

            @entity()
            model Test {
                @key otherKey: numeric,
                @key myId: numeric
            }
        `);
        const filePath = pathPrefix + "hoist-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should handle cyclic composite keys", async () => {
        const res = await sqlFor(`
            @entity()
            model One {
                test: Test;
                @key id: numeric;
                @key alsoId: numeric
            }

            @entity()
            model Test {
                @key otherKey: numeric;
                @key myId: numeric;
                one: One
            }
        `);
        const filePath = pathPrefix + "cyclic-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should handle nested composite-key", async () => {
        const res = await sqlFor(`
            @entity()
            model One {
                testMP: Test;
                @key id: numeric;
                @key alsoId: numeric
            }

            @entity()
            model Test {
                @key oneMP: One
            }
        `);
        const filePath = pathPrefix + "double-composite-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should de-reference model-arrays as n:m relationships", async () => {
        const res = await sqlFor(`
            @entity()
            model One {
                nToM: Test[];
                @key id: numeric;
            }

            @entity()
            model Test {
                @key id: numeric 
            }
        `);
        const filePath = pathPrefix + "n-to-m-key.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should de-reference model-arrays as m:n relationships (order-changed)", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key id: numeric 
            }

            @entity()
            model One {
                nToM: Test[];
                @key id: numeric;
            }
        `);
        const filePath = pathPrefix + "n-to-m-key-order-change.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should handle n:m relationships even if they need to be cut out", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key id: numeric;
                one: One;
            }

            @entity()
            model One {
                nToM: Test[];
                @key id: numeric;
                test: Test;
            }
        `);
        const filePath = pathPrefix + "n-to-m-with-circle.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should handle n:m relationships in a namespace", async () => {
        const res = await sqlFor(`
            namespace MyTestName;
            @entity()
            model Test {
                @key id: numeric;
                one: One;
            }

            @entity()
            model One {
                nToM: Test[];
                @key id: numeric;
                test: Test;
            }
        `);
        const filePath = pathPrefix + "n-to-m-in-a-namespace.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should throw an error on having a nested composite-key that also de-references a n:m relationship", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model Test {
                @key id: numeric;
                one: One;
            }

            @entity()
            model One {
                @key nToM: Test[];
                @key num: numeric;
            }
        `);
        expectDiagnostics(diagnostics, [
          {
            code: "typespec-postgres/reference-array-has-multiple-key",
            message: "Could not create a column from 'One' as part of an many to many relation, because it has a compound key",
          },
          {
            code: "typespec-postgres/reference-array-could-not-create-column",
            message: "Could not create a column from 'nToM' as part of an many to many relation",
          },
          {
            code: "typespec-postgres/composite-key-error",
            message: "There was an error in building the composite key type of 'oneNToM'",
          },
        ]);
    });

    it("Check Arrays of automatic references throws an error if one of them has a compound key", async () => {
        const diagnostics = await diagnoseSQLFor(`
          @entity("myName") model Foo {
            @key id: numeric,
            @key otherKey: numeric
          };
    
          @entity() model Foo2 {
            fooArray: Foo[],
            @key id: numeric,
          };
        `);
        expectDiagnostics(diagnostics, [
          {
            code: "typespec-postgres/reference-array-has-multiple-key",
            message: "Could not create a column from 'Foo' as part of an many to many relation, because it has a compound key",
          },
          {
            code: "typespec-postgres/reference-array-could-not-create-column",
            message: "Could not create a column from 'fooArray' as part of an many to many relation",
          },
        ]);
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

    // TODO: add tests for very weird key-structures
});