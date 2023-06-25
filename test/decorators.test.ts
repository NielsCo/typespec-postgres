import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import fs from "fs";
const pathPrefix = './test/assets/decorators/';

describe("Decorators", () => {

  // Check everything works fine
  it("Check Min Length", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        @minLength(20)
        stringName?: string,
      };
    `);
    const filePath = pathPrefix + "minLength.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Check Max Length", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        @maxLength(20)
        stringName?: string,
      };
    `);
    const filePath = pathPrefix + "maxLength.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Check Min and max Length", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        @maxLength(20) @minLength(10)
        stringName: string,
      };
    `);
    const filePath = pathPrefix + "minMaxLength.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Check min and max value", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        @minValue(20) @maxValue(300)
        myNumber: int32,
      };
    `);
    const filePath = pathPrefix + "minMaxValue.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Check exclusiveMin and exclusiveMax value", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        @minValueExclusive(20) @maxValueExclusive(300)
        myNumber: int32,
      };
    `);
    const filePath = pathPrefix + "exclusiveMinMaxValue.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Check that the emitter options work", async () => {
    const res = await sqlFor(`
    model Foo {
      @key myId: string,
    };
    `, undefined, { "emit-non-entity-types": true });
    const filePath = pathPrefix + "emitter-options.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

    strictEqual(res, expectedSQL);
  });


  it("Check @key Decorator", async () => {
    const res = await sqlFor(`
      @entity("myName") model Foo {
        @key myId: string,
      };
    `);
    const filePath = pathPrefix + "key.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

    strictEqual(res, expectedSQL);
  });

  it("Should not allow @Entity on properties types", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      model Foo {
        @entity() myId: string
      };`
    );

    expectDiagnostics(diagnostics, [
      {
        code: "decorator-wrong-target",
        message: "Cannot apply @entity decorator to (anonymous model).myId since it is not assignable to Model | Enum",
      },
    ]);
  });

  it("Should allow @entity on Enums and Models", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("myName") model Foo {
        myEnumValue: MyEnum,
      };

      @entity("test") enum MyEnum {
        "test", "test2", "test3"
      };
    `);

    expectDiagnostics(diagnostics, []);
  });

  it("Should not allow two different named Model to have the same Entity Name", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Test") model Foo2 {
        myId: string
      };

      @entity("Test") model Foo {
        myId2040: string
      };`
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'Test' is defined twice",
      },
    ]);
  });

  it("Should not allow an Entity to have the same name as a model", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Foo") model Foo2 {
        myId: string
      };

      @entity() model Foo {
        myId2040: string
      };`
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'Foo' is defined twice",
      },
    ]);
  });

  it("Should throw if a name is already taken but assigned by the @entity(name) decorator param", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Foo") enum Foo2 {
        "a", "b", "c"
      };

      @entity() enum Foo {
        "a", "b", "c"
      };

      @entity("Test") enum Test2 {
        "a", "b", "c"
      };

      @entity() enum Test {
        "a", "b", "c"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'Foo' is defined twice",
      },
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'Test' is defined twice",
      },
    ]);
  });

  it("Should not allow two Enums to have the same entity name", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Foo") enum Foo2 {
        "a", "b", "c"
      };

      @entity("Foo") enum Foo {
        "a", "b", "c"
      };`
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'Foo' is defined twice",
      },
    ]);
  });

  it("Should not allow to have an Enum have the same name as a Model via the Entity name", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Foo") model Foo2 {
        myId: string
      };

      @entity() enum Foo {
        "a", "b", "c"
      };`
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'Foo' is defined twice",
      },
    ]);
  });

  it("Should warn when a decorator of an array type can not be emitted", async () => {
    const code = `
        @minLength(10)
        scalar myString extends string;
  
        @entity("myName") model Foo {
          varChars: myString[],
        };
      `;
    const diagnostics = await diagnoseSQLFor(code);
    expectDiagnostics(diagnostics, [{
      code: "typespec-postgres/array-constraints",
      message: "Can not add all decorator-constraints to 'varChars' because array constraints are not implemented yet",
      severity: "warning"
    }]);
    const res = await sqlFor(code, undefined, undefined, true);
    const filePath = pathPrefix + "custom-scalars-arrays.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Should not warn for UUID-arrays", async () => {
    const code = `
      @encode("UUID")
      scalar myString extends string;

      @entity("myName") model Foo {
        varChars: myString[],
      };
    `;
    const res = await sqlFor(code);
    const filePath = pathPrefix + "uuid-arrays.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Should warn about custom scalar properties not being emitted and but emit uuid-either-way", async () => {
    const code = `
      @encode("UUID")
      @maxLength(20)
      scalar myString extends string;

      @entity("myName") model Foo {
        varChars: myString[],
      };
    `;
    const diagnostics = await diagnoseSQLFor(code);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/array-constraints",
        message: "Can not add all decorator-constraints to 'varChars' because array constraints are not implemented yet",
        severity: "warning"
      },
    ]);
    const res = await sqlFor(code, undefined, undefined, true);
    const filePath = pathPrefix + "uuid-arrays.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Should apply custom scalar decorators to types in properties", async () => {
    const res = await sqlFor(`
      @encode("uuid")
      @maxLength(20)
      scalar myString extends string;

      @entity("myName") model Foo {
        varChar: myString,
      };
    `);
    const filePath = pathPrefix + "custom-scalars.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Should apply custom scalar doc to types in properties", async () => {
    const res = await sqlFor(`
      @encode("uuid")
      @maxLength(20)
      @doc("this is a doc-test")
      @externalDocs("test.test", "wow")
      scalar myString extends string;

      @entity("myName") model Foo {
        varChar: myString,
      };
    `);
    const filePath = pathPrefix + "custom-scalars-doc.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Check that inherited decorators work", async () => {
    const res = await sqlFor(`
    model Base {
        @maxLength(40) @doc("myTest") @key id: uuid;
    }
    
    @entity()
    model Child1 extends Base {
        @path someId1: uuid;
    }
    
    @entity()
    model Child2 extends Base {
        @path someId2: uuid,
    }
    
    @externalDocs("test.test", "someExternalStuff")
    @minLength(30)
    @doc("anotherTest")
    @encode("uuid")
    scalar uuid extends string;
    `);
    const filePath = pathPrefix + "inherited-decorators.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

    strictEqual(res, expectedSQL);
  });

  it("Should throw an error for duplicate names with different cases with the entity name set last", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity() enum One {
        "a", "b"
      };
      @entity("one") enum Test {
        "a", "b", "c"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'one' is defined twice",
      },
    ]);
  });

  it("Should throw an error for duplicate names with different cases with the entity name set first", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("one") enum Test {
        "a", "b", "c"
      };
      @entity() enum One {
        "a", "b"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/duplicate-entity-identifier",
        message: "The entity 'one' is defined twice",
      },
    ]);
  });

  it("Should throw an error on using a reserved keyword as an entity name", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Table") enum Test {
        "a", "b", "c"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reserved-entity-name",
        message: "Can not create the entity 'Table' as its name is a reserved keyword in PostgreSQL",
      },
    ]);
  });

  it("Should throw an error on using a reserved keyword as a model name", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity() enum Table {
        "a", "b", "c"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reserved-entity-name",
        message: "Can not create the entity 'Table' as its name is a reserved keyword in PostgreSQL",
      },
    ]);
  });

  it("Should throw an error if an entity name contains forbidden characters", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("test.") enum Table {
        "a", "b", "c"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/invalid-entity-name",
        message: "The name 'test.' is an invalid name for a PostgreSQL entity",
      },
    ]);
  });

  it("Should throw an error if an entity name is too long", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("Th1s_i5_a_str1ng_w1th_exactly_64_characters_and_underscores_1234") enum Table {
        "a", "b", "c"
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/entity-name-too-long",
        message: "The name 'Th1s_i5_a_str1ng_w1th_exactly_64_characters_and_underscores_1234' is too long for a PostgreSQL entity",
      },
    ]);
  });

  it("Should warn about that only uuid is known as a format-type", async () => {
    const code = `
      @encode("not-uuid")
      scalar myString extends string;

      @entity("myName") model Foo {
        varChars: myString,
      };
    `;
    const diagnostics = await diagnoseSQLFor(code);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/unsupported-format",
        message: "The format 'not-uuid' is not recognized. Only 'UUID' is recognized as a format in the current version",
        severity: "warning"
      },
    ]);
    const res = await sqlFor(code, undefined, undefined, true);
    const filePath = pathPrefix + "unknown-format.sql";
    const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    strictEqual(res, expectedSQL);
  });

  it("Should throw an error if the @entity() decorator uses a reserved name", async () => {
    const diagnostics = await diagnoseSQLFor(
      `
      @entity("table") model Test {
        someProp: numeric
      };
      `
    );

    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reserved-entity-name",
        message: "Can not create the entity 'table' as its name is a reserved keyword in PostgreSQL",
      },
    ]);
  });
});