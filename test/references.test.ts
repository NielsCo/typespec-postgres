import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import fs from "fs";
const pathPrefix = './test/assets/references/';

describe("Model Referencing", () => {

    it("Should allow cyclic references with keys", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                anotherTestReference: AnotherTest,
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                testReference: Test,
                @key myId: numeric
            }    
        `);
        const filePath = pathPrefix + "cyclic.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
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

    it("Should handle simple reference", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                anotherTest: AnotherTest
            }

            @entity()
            model AnotherTest {
                @key myId: numeric
            }    
        `);
        const filePath = pathPrefix + "simple.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should sort and link(add entities without @entity() to the output) multiple manual model references", async () => {
        const res = await sqlFor(`
            model Test {
                @references(AnotherTest) anotherTest: numeric, 
                @key myId: numeric
            }

            model AnotherTest {
                @key myId: numeric
            }
            
            @entity()
            model ReferenceBoth {
                @references(AnotherTest) anotherTest: numeric,
                @references(Test)test: numeric
            }
        `);
        const filePath = pathPrefix + "multiple-manual.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should sort multiple automatic model references", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                anotherTest: AnotherTest,
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                @key myId: numeric
            }
            
            @entity()
            model ReferenceBoth {
                anotherTest: AnotherTest,
                test: Test
            }
        `);
        const filePath = pathPrefix + "multiple-automatic.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should not allow reference to a model without a primary key", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model Test {
                anotherTest: AnotherTest,
            }

            @entity()
            model AnotherTest {
                notAnId: numeric
            }
        `);
        expectDiagnostics(diagnostics, [
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

    it("Should parse cyclic referencing models and reference them too", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                anotherTestReference: AnotherTest,
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                testReference: Test,
                @key myId: numeric
            }
            
            @entity()
            model ReferenceBoth {
                anotherTest: AnotherTest,
                test: Test
            }
        `);
        const filePath = pathPrefix + "cyclic-and-referenced.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should parse cyclic references and non-cyclic references", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                anotherTestReference: AnotherTest,
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                testReference: Test,
                @key myId: numeric
            }
            
            @entity()
            model Root {
                @key parentId: numeric
            }

            @entity()
            model Child {
                parent: Root
            }
        `);
        const filePath = pathPrefix + "cyclic-and-non-cyclic.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should recognize references with @references decorator", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                @references(Test) test_id: numeric,
                @key myId: numeric
            }
        `);
        const filePath = pathPrefix + "reference-decorator.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should throw an error when using references to a model without a key", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model Test {
                myId: numeric
            }

            @entity()
            model AnotherTest {
                @references(Test) test_id: string,
                @key myId: numeric
            }
        `);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/references-has-no-key",
                message: "Can not use references to 'Test' because it does not have a @key",
            },
        ]);
    });

    it("Should throw an error when using references to a model with a key with a different dataType", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model Test {
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                @references(Test) test_id: string,
                @key myId: numeric
            }
        `);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/references-has-different-type",
                message: "Cannot reference the key-type 'Scalar'. The key of a referenced model must have the same type as the referencing property",
            },
        ]);
    });

    it("Should throw an error when using references to non-existing models", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model AnotherTest {
                @references(Foo) test_id: string,
                @key myId: numeric
            }
        `);
        expectDiagnostics(diagnostics, [
            {
                code: "unknown-identifier",
                message: "Unknown identifier Foo",
            },
            {
                code: "invalid-argument",
                message: "Argument 'ErrorType' is not assignable to parameter of type 'Model'",
            },
        ]);
    });

    it("Should allow manual self-references", async () => {
        const res = await sqlFor(`
            @entity()
            model AnotherTest {
                @references(AnotherTest) test_id: numeric,
                @key myId: numeric
            }
        `);
        const filePath = pathPrefix + "manual-self-references.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should allow automatic self-references", async () => {
        const res = await sqlFor(`
            @entity()
            model AnotherTest {
                test_id: AnotherTest,
                @key myId: numeric
            }
        `);
        const filePath = pathPrefix + "automatic-self-references.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should create manual references from namespaces to other namespaces", async () => {
        const res = await sqlFor(`
            namespace one.two.three {
                    @entity()
                    model AnotherTest {
                        test_id: AnotherTest,
                        @key myId: numeric
                    }
            }
            @entity()
            model Test {
                @references(one.two.three.AnotherTest) anotherTest: numeric
            }
        `);
        const filePath = pathPrefix + "manual-referencing-namespaces.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Check automatic references to inheritance structures", async () => {
        const res = await sqlFor(`
        @entity()
        model BaseModel {
            @path @key id: numeric;
        }
        
        @entity()
        model LevelOneModel extends BaseModel {
            anotherProperty: numeric
        }
        
        @entity()
        model LevelTwoModel extends LevelOneModel {
            yetAnotherProperty: numeric
        }

        @entity()
        model referencesThemAll {
            base: BaseModel,
            one: LevelOneModel,
            two: LevelTwoModel
        }
        `);
        const filePath = pathPrefix + "reference-automatic-inheritance.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Check manual references to inheritance structures", async () => {
        const res = await sqlFor(`
        @entity()
        model BaseModel {
            @path @key id: numeric;
        }
        
        @entity()
        model LevelOneModel extends BaseModel {
            anotherProperty: numeric
        }
        
        @entity()
        model LevelTwoModel extends LevelOneModel {
            yetAnotherProperty: numeric
        }

        @entity()
        model referencesThemAll {
            @references(BaseModel)
            baseId: numeric,
            @references(LevelOneModel)
            oneId: numeric,
            @references(LevelTwoModel)
            twoId: numeric
        }
        `);
        const filePath = pathPrefix + "reference-manual-inheritance.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Check automatic array reference", async () => {

        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model Coverage {
                lineOfBusinessId: numeric;
                isCovered: boolean;
            }
            @entity()
                model CoverageDataRequest {
                coverages: Coverage[];
            }
        `);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/reference-without-key",
                message: "Can not reference 'Coverage' automatically because it does not have a @key",
            },
            {
                code: "typespec-postgres/datatype-not-resolvable",
                message: "The datatype of the model property of type 'Model' can not be resolved",
            },
        ]);
    });

    it("Should allow an enum as a key and as a reference key", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                @key my: MyEnum
            }

            @entity()
            model AnotherTest {
                testReference: Test,
            }
            
            @entity()
            enum MyEnum {
                "a", "b"
            }
        `);
        const filePath = pathPrefix + "enum-references.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should handle uuid as a format of a key and automatically and manually reference it", async () => {
        const res = await sqlFor(`

            @encode("uuid")
            scalar uuid extends string;

            @entity()
            model Test {
                @key id: uuid
            }

            @entity()
            model AutomaticTest {
                testReference: Test,
            }

            @entity()
            model ManualTest {
                @references(Test)
                reference: uuid
            }
        `);
        const filePath = pathPrefix + "uuid-references.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should check that references to enums are not allowed", async () => {
        const diagnostics = await diagnoseSQLFor(
            `
            enum MyEnumTest {
                "a","b","c"
            }

            @entity()
            model AutomaticTest {
                @references(MyEnumTest)
                enumReference: string
            }
          `
        );

        expectDiagnostics(diagnostics, [
            {
                code: "invalid-argument",
                message: "Argument 'MyEnumTest' is not assignable to parameter of type 'Model'",
            },
        ]);
    });

    it("Should add referenced models of entities to the output even if they aren't entities themselves", async () => {
        const res = await sqlFor(`
            model MyTest {
                @key id: string
            }

            @entity()
            model AutomaticTest {
                @references(MyTest)
                reference: string
            }
          `
        );
        const filePath = pathPrefix + "added-entity.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should throw an error if references type is an enum", async () => {
        const diagnostics = await diagnoseSQLFor(
            `
            enum TestEnum {
                "a","b"
            }

            @entity()
            model Test {
                @key id: TestEnum
            }

            @entity()
            model AutomaticTest {
                @references(Test)
                testReference: TestEnum,
            }
          `);

        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/reference-not-allowed",
                message: "References of the type 'Enum' are not allowed",
            },
        ]);
    });

    it("Should throw an error if references type is a union type", async () => {
        const diagnostics = await diagnoseSQLFor(
            `
            @entity()
            model Test {
                @key id: "a" | "b"
            }

            @entity()
            model AutomaticTest {
                @references(Test)
                testReference: "a" | "b"
            }
          `);

        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/reference-not-allowed",
                message: "References of the type 'Union' are not allowed",
            },
        ]);
    });

    it("Anonymous objects should work as keys and be able to be referenced manually if they have keys as properties", async () => {
        const code = `
            @entity()
            model Test {
                @key id: {@key anObject: "can not be a reference", test: {@key what: "this can even have another inner object"}}
            }

            @entity()
            model AutomaticTest {
                @references(Test)
                testReference: Test,
            }
        `;
        const res = await sqlFor(code, undefined, undefined, true);
        const diagnostics = await diagnoseSQLFor(code);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/duplicate-anonymous-name",
                message: "The type '' has a collision with another entity. The name may be generated from an anonymous model name",
            },
        ]);
        const filePath = pathPrefix + "manual-references-objects.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should throw an error if automatic and manual referencing differ", async () => {
        const code = `
            @entity()
            model Test {
                @key id: {@key anObject: "can not be a reference", test: {@key what: "this can even have another inner object"}}
            }

            @entity()
            model AutomaticTest {
                @references(Another)
                testReference: Test,
            }

            model Another {
                @key id: numeric
            }
        `;
        const diagnostics = await diagnoseSQLFor(code);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/different-models-referenced",
                message: "The @references decorator must point to the same model as the property type but it points to 'Another'",
            },
        ]);
    });

    it("Anonymous objects should work as keys and be able to be referenced automatically if they have keys as properties", async () => {
        const code = `
            @entity()
            model Test {
                @key id: {@key anObject: "can not be a reference", test: {@key what: "this can even have another inner object"}}
            }

            @entity()
            model AutomaticTest {
                testReference: Test,
            }
        `;
        const res = await sqlFor(code, undefined, undefined, true);
        const diagnostics = await diagnoseSQLFor(code);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/duplicate-anonymous-name",
                message: "The type '' has a collision with another entity. The name may be generated from an anonymous model name",
            },
        ]);
        const filePath = pathPrefix + "automatic-references-objects.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should not allow tuples as manual references types", async () => {
        const diagnostics = await diagnoseSQLFor(`
        @entity()
        model Test {
        @references(Test2)
            check: [int32, int64, string]
        }
        @entity()
        model Test2 {
            @key check: [int32, int64, string]
        }
        `);
        expectDiagnostics(diagnostics, [{
            code: "typespec-postgres/reference-not-allowed",
            message: "References of the type 'Tuple' are not allowed",
        },]);
    });

    it("Should not allow references on Intrinsic", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model MyTest {
                @references(Intrinsic)
                in: never;
            }
            model Intrinsic {
                @key id: never
            }
          `
        );
        expectDiagnostics(diagnostics, [{
            code: "typespec-postgres/reference-not-allowed",
            message: "References of the type 'Intrinsic' are not allowed",
        },]);
    });

    it("Should allow references on all numeric, boolean and scalar types", async () => {
        const res = await sqlFor(`
            @entity()
            model MyTest {
                @references(Number)
                number: numeric;
                @references(Boo)
                boo: boolean;
                @references(ScalarId)
                scalarId: MyScalar
            }
            model Number {
                @key id: numeric
            }
            model Boo {
                @key id: boolean
            }
            @doc("hello")
            scalar MyScalar extends string
            model ScalarId {
                @key id: MyScalar
            }
          `
        );
        const filePath = pathPrefix + "references-types.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("should handle automatic and manual references that are specific enum-values", async () => {
        const res = await sqlFor(`
        
        // TODO: check whether we want to actually apply the default value for the automatic reference!
        @entity()
        model Ten {
          @key id: Test.ten
        }

        @entity()
        model Hundred {
          @key id: Test.hundred
        }

        @entity()
        model ReferencesThem {
            ten: Ten;
            @references(Hundred)
            hundred: Test.hundred;
        }
        
        enum Test {
          ten: "10",
          hundred: "100"
        }
        
        `);
        const filePath = pathPrefix + "enum-member-references.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
      });
});