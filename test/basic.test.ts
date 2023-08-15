import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
import fs from "fs";
const pathPrefix = './test/assets/basic/';

describe("basic tests", () => {
  it("Check Model with one optional Entity", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        stringName?: string,
      };
    `);
    const filePath = pathPrefix + "optionalEntity.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  it("Check Model with required Entity", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        stringName: string,
      };
    `);
    const filePath = pathPrefix + "requiredEntity.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  it("Check that basic versioning works", async () => {
    const { v1, v2, v3 } = await sqlFor(
      `
      @versioned(Versions)
      @service({title: "My Service"})
      namespace MyService {
        enum Versions {
          @useDependency(MyLibrary.Versions.A)
          "v1",
          @useDependency(MyLibrary.Versions.B)
          "v2",
          @useDependency(MyLibrary.Versions.C)
          "v3"}
        @entity()
        model Test {
          prop1: string;
          @added(Versions.v2) prop2: string;
          @removed(Versions.v2) prop3: string;
          @renamedFrom(Versions.v3, "prop4") prop4new: string;
          @madeOptional(Versions.v3) prop5?: string;
        }

        @route("/read1")
        op read1(): Test;
        op read2(): MyLibrary.Foo;
      }

      @versioned(Versions)
      namespace MyLibrary {
        enum Versions {A, B, C}

        model Foo {
          prop1: string;
          @added(Versions.B) prop2: string;
          @added(Versions.C) prop3: string;
        }
      }
    `,
      ["v1", "v2", "v3"]
    );
    const filePathV1 = pathPrefix + "v1.sql";
    const expectedSQLv1 = await readAndNormalize(filePathV1);
    const filePathV2 = pathPrefix + "v2.sql";
    const expectedSQLv2 = await readAndNormalize(filePathV2);
    const filePathV3 = pathPrefix + "v3.sql";
    const expectedSQLv3 = await readAndNormalize(filePathV3);

    strictEqual(v1, expectedSQLv1);
    strictEqual(v2, expectedSQLv2);
    strictEqual(v3, expectedSQLv3);
  });

  it("Check Simple Enum Test", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        myEnumValue: MyEnum,
      };
      enum MyEnum {
        "test", "test2", "test3"
      };
    `);
    const filePath = pathPrefix + "enum.sql";
    const expectedSQL = await readAndNormalize(filePath)

    strictEqual(res, expectedSQL);
  });

  it("Should use new-line-characters set in options", async () => {
    const res = await sqlFor(`
      @entity()
      model Foo {
        myEnumValue: MyEnum,
      };
      @entity()
      enum MyEnum {
        "test", "test2", "test3"
      };
    `, undefined, { "new-line": "lf" });

    const filePath = pathPrefix + "other-new-lines.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

    strictEqual(res, expectedSQL);
  });

  it("Should not emit models without @entity() decorator", async () => {
    const res = await sqlFor(`
      model Foo {
        myEnumValue: MyEnum,
      };
      enum MyEnum {
        "test", "test2", "test3"
      };
    `);

    strictEqual(res, "");
  });

  it("Should not allow enums of the type number", async () => {
    const diagnostics = await diagnoseSQLFor(`
    @entity()
    enum myEnum {
      test: 20, prop: 30
    }
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/unimplemented-enum-type",
        message: "Enum Members of the type 'number' are not implemented because they can not be mapped to PostgreSQL enums",
      },
    ]);
  });

  it("Check that docs work on all levels", async () => {
    const res = await sqlFor(`
    @doc("test")
    @autoRoute
    op get(): MyModel;

    @externalDocs("test.com")
    @doc("this is my test for enum")
    @entity()
    enum MyEnum {
      @externalDocs("test.com", "test-enum1")
      @doc("test the doc feature for enum1")
      test,

      @doc("test the doc feature for enum2")
      test2,

      @doc("test the doc feature for enum3")
      test3,
    }

    @externalDocs("test.com", "test-MyModel")
    @doc("this is a test")
    @entity()
    model MyModel {
      @externalDocs("test.com", "test-MyModel-someEntity")
      @doc("this is a modelProperty test")
      someEntity: string;
      @doc("modelProperty for reference")
      reference: ReferencedModel
    }

    @doc("referenced Model")
    model ReferencedModel {
      @doc("key value")
      @key myId: numeric
    }
    `);
    const filePath = pathPrefix + "docs.sql";
    const expectedSQL = await readAndNormalize(filePath)

    strictEqual(res, expectedSQL);
  });

  it("Check that inheritance works", async () => {
    const res = await sqlFor(`
    @entity()
    model BaseModel {
        @path @key id: numeric;
    }
    
    @entity()
    model LevelOneModel extends BaseModel {
        anotherProperty: numeric;
    }
    
    @entity()
    model LevelTwoModel extends LevelOneModel {
        yetAnotherProperty: numeric;
    }
    
    @encode("UUID")
    scalar UUID extends string;
    `);
    const filePath = pathPrefix + "inheritance.sql";
    const expectedSQL = await readAndNormalize(filePath)

    strictEqual(res, expectedSQL);
  });

  it.skip("Check handling of keys in inheritance structures", async () => {
    const diagnostics = await diagnoseSQLFor(`
    @entity()
    model Child extends Parent {
      @key id: numeric;
    }
    
    @entity()
    model Parent {
      @key parentKey: string;
    }
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/multiple-key-declarations",
        message: "Can not add Model property 'parentKey' as key because there already exists another key",
      },
    ]);
  });

  it("Should not emit generic models", async () => {
    const res = await sqlFor(`
    model Child extends Person {
      school: string,
    }
    
    model Person {
      @key id: string;
    }
    
    @entity
    model GenericModel<Member extends Person> {
      reference: Member
    }
    

    `);
    strictEqual(res, "");
  });

  it("Should handle generic models with inheritance", async () => {
    const res = await sqlFor(`
    model Child extends Person {
      school: string;
    }
    
    model Parent extends Person {
      workplace: string,
    }
    
    model Person {
      @key id: string;
    }
    
    model GenericModel<Member extends Person> {
      reference: Member;
    }
    
    @entity
    model Father extends GenericModel<Parent> {
      golfBallsInCollection: int16,
    }
    
    @entity
    model Son extends GenericModel<Child> {
      numberOfAirplanes: numeric;
    }
    
    `);
    const filePath = pathPrefix + "generics.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  it("Should not emit generic model", async () => {
    const res = await sqlFor(`
    model Child extends Person {
      school: string;
    }
    
    model Parent extends Person {
      workplace: string,
    }
    
    model Person {
      @key id: string;
    }
    
    @entity
    model GenericModel<Member extends Person> {
      reference: Member;
    }
    `);
    strictEqual(res, '');
  });

  it("Should handle literal Object Types", async () => {
    const res = await sqlFor(`
    
    @entity
    model test {
      testProperty: {
        value: string,
        anotherValue: "string",
        @key andEvenMore: "test"
      };
    }
    
    `);
    const filePath = pathPrefix + "literal-object.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  it.skip("Should handle literal Object Types without key", async () => {
    const res = await sqlFor(`
    
    @entity
    model test {
      test: {
        value: "test",
        anotherValue: "string",
        andEvenMore: "test"
      };
    }
    
    `);
    const filePath = pathPrefix + "literal-object.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  it("Should not allow reserved words as column names", async () => {
    const diagnostics = await diagnoseSQLFor(`
    @entity()
    model notAllowed {
      TABLE: numeric
    }
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reserved-column-name",
        message: "Can not create the column 'TABLE' as its name is a reserved keyword in PostgreSQL",
      },
    ]);
  });

  it("Should allow reserved words table names inside schemas", async () => {
    const diagnostics = await diagnoseSQLFor(`
    namespace one {
      @entity()
      // as this entity has the schema as a prefix this is allowed
      model Table {
        someProp: numeric
      }
    }
    `);
    expectDiagnostics(diagnostics, []);
  });

  it("Using a tuple should throw an error", async () => {
    const diagnostics = await diagnoseSQLFor(`
    @entity()
    model Test {
      check: [int32, int64, string]
    }
    `);
    expectDiagnostics(diagnostics, [{
      code: "typespec-postgres/unsupported-type",
      message: "The type 'Tuple' is not supported",
    },]);
  });

  it("should handle enum-members with specific names", async () => {
    const res = await sqlFor(`
    
    @entity()
    model UsesTest {
      value: Test.one;
      valueTwo: Test.two;
      valueThree: Test.three;
    }
    
    enum Test {
      one: "10",
      two: "100",
      three: "1000"
    }
    
    `);
    const filePath = pathPrefix + "enum-members.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });
});