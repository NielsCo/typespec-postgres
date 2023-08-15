import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
const pathPrefix = './test/assets/arrays/';

describe("arrays", () => {
  it("Check Arrays of automatic references throw errors", async () => {
    const diagnostics = await diagnoseSQLFor(`
      @entity("myName") model Foo {
        @key() id: numeric,
      };

      @entity() model Foo2 {
        fooArray: Foo[]
      };
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reference-array",
        message: "Can not create array references in the property 'fooArray' in the current version",
      },
      {
        code: "typespec-postgres/datatype-not-resolvable",
        message: "The datatype of the model property of type 'Model' can not be resolved",
      },
    ]);
  });

  it("Check Arrays of manual references throw errors", async () => {
    const diagnostics = await diagnoseSQLFor(`
      @entity("myName") model Foo {
        @key() id: numeric,
      };

      @entity() model Foo2 {
        @references(Foo)
        fooArray: numeric[]
      };
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reference-array",
        message: "Can not create array references in the property 'fooArray' in the current version",
      },
    ]);
  });

  it("Check that arrays of manual references throw the correct error", async () => {
    const diagnostics = await diagnoseSQLFor(`
      @entity("myName") model Foo {
        @key() id: numeric[],
      };

      @entity() model Foo2 {
        @references(Foo)
        fooArray: numeric[]
      };
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reference-array",
        message: "Can not create array references in the property 'fooArray' in the current version",
      },
    ]);
  });

  it("Check Models basic Array-Property", async () => {
    const res = await sqlFor(`
    @entity("myName") model Foo {
      stringNames: string[],
      numbers: numeric[],
    };
  `);
    const filePath = pathPrefix + "basic-array.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  it("Check an array as a primary key works", async () => {
    const res = await sqlFor(`
    @entity("myName") model Foo {
      @key() id: numeric[],
    };

    @entity() model Foo2 {
      fooArray: Foo
    };
    `);
    const filePath = pathPrefix + "primary-key-array.sql";
    const expectedSQL = await readAndNormalize(filePath)
    strictEqual(res, expectedSQL);
  });

  // it.only("Check Arrays of custom scalars", async () => {
  //   const res = await sqlFor(`
  //     @encode("UUID")
  //     @maxLength(20)
  //     scalar myString extends string;

  //     @entity("myName") model Foo {
  //       @maxLength(20)
  //       varChar: myString,

  //       varChars: myString[],
  //     };
  //   `);
  //   const filePath = pathPrefix + "basic-array.sql";
  //   const expectedSQL = await readAndNormalize(filePath)
  //   strictEqual(res, expectedSQL);
  // });
});