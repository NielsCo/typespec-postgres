import { sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
const pathPrefix = './test/assets/save-mode/';

describe("save-mode", () => {
    it("Should create schemas in a save way", async () => {
        const res = await sqlFor(
            `
        namespace one {
            @entity("Foo") model Foo2 {
            myId: string
            };
        }

        namespace two {
            @entity("Foo") model Foo2 {
            myId: string
            };
        }
        
        @entity("Foo") model Foo2 {
            myId: string
        };
        `
            , undefined, { "save-mode": true });

        const filePath = pathPrefix + "name-collision-save.sql";
        const expectedSQL = await readAndNormalize(filePath)

        strictEqual(res, expectedSQL);
    });

    it("Should create nested schema in a save way", async () => {
        const res = await sqlFor(
            `
        namespace one {
            namespace two {
                namespace three {
                    @entity("Foo") model Foo2 {
                        myId: string
                    };
                }
            }
        }

        namespace this.can.be.very.nested.thing {
            @entity("Foo") model Nested {
                myId: string
            };
        }

        namespace two {
            @entity("Foo") model Foo2 {
            myId: string
            };
        }
        
        @entity("Foo") model Foo2 {
            myId: string
        };
        `
            , undefined, { "save-mode": true });

        const filePath = pathPrefix + "nested-save.sql";
        const expectedSQL = await readAndNormalize(filePath)

        strictEqual(res, expectedSQL);
    });

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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "cyclic-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should create simple references in a save-mode", async () => {
        const res = await sqlFor(`
            @entity()
            model Test {
                anotherTest: AnotherTest
            }

            @entity()
            model AnotherTest {
                @key myId: numeric
            }    
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "simple-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should sort and link references in save-mode", async () => {
        const res = await sqlFor(`
            @entity()
            model ReferenceBoth {
                @references(AnotherTest) anotherTest: numeric,
                @references(Test)test: numeric
            }

            model Test {
                @references(AnotherTest) anotherTest: numeric, 
                @key myId: numeric
            }

            model AnotherTest {
                @key myId: numeric
            }
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "multiple-manual-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should sort multiple automatic references in save-mode", async () => {
        const res = await sqlFor(`
            @entity()
            model ReferenceBoth {
                anotherTest: AnotherTest,
                test: Test
            }


            @entity()
            model Test {
                anotherTest: AnotherTest,
                @key myId: numeric
            }

            @entity()
            model AnotherTest {
                @key myId: numeric
            }
            

        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "multiple-automatic-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should parse cyclic referencing models in save-mode", async () => {
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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "cyclic-and-referenced-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should parse cyclic references and non-cyclic references in save-mode", async () => {
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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "cyclic-and-non-cyclic-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should recognize references with @references decorator in save-mode", async () => {
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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "reference-decorator-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should allow manual self-references in save-mode", async () => {
        const res = await sqlFor(`
            @entity()
            model AnotherTest {
                @references(AnotherTest) test_id: numeric,
                @key myId: numeric
            }
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "manual-self-references-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should allow automatic self-references in save-mode", async () => {
        const res = await sqlFor(`
            @entity()
            model AnotherTest {
                test_id: AnotherTest,
                @key myId: numeric
            }
        `, undefined, {"save-mode": true});
        const filePath = pathPrefix + "automatic-self-references-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should create manual references from namespaces to other namespaces in save-mode", async () => {
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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "manual-referencing-namespaces-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Check automatic references to inheritance structures in save-mode", async () => {
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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "reference-automatic-inheritance-save.sql";
        const expectedSQL = await readAndNormalize(filePath)

        strictEqual(res, expectedSQL);
    });

    it("Check manual references to inheritance structures in save-mode", async () => {
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
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "reference-manual-inheritance-save.sql";
        const expectedSQL = await readAndNormalize(filePath)

        strictEqual(res, expectedSQL);
    });

    it("Check Simple Enum Test", async () => {
        // TODO: in another issue change enums to also be emitted save
        const res = await sqlFor(`
          @entity("myName") model Foo {
            myEnumValue: MyEnum,
          };
          enum MyEnum {
            "test", "test2", "test3"
          };
        `, undefined, { "save-mode": true });
        const filePath = pathPrefix + "enum-save.sql";
        const expectedSQL = await readAndNormalize(filePath)
    
        strictEqual(res, expectedSQL);
      });
});