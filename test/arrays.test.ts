import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
const pathPrefix = './test/assets/arrays/';

describe("arrays", () => {
  it("Check Arrays of automatic references throws an error if one of them does not have a key", async () => {
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
        code: "typespec-postgres/reference-array-has-no-key",
        message: "Can not create a references to 'Foo2' as part of an many to many relation, because it does not have a @key",
      },
      {
        code: "typespec-postgres/reference-array-could-not-create-column",
        message: "Could not create a column from 'fooArray' as part of an many to many relation",
      },
    ]);
  });

  it("Check Arrays of automatic references throws an error if both of them do not have a key", async () => {
    const diagnostics = await diagnoseSQLFor(`
      @entity("myName") model Foo {
        id: numeric,
      };

      @entity() model Foo2 {
        fooArray: Foo[]
      };
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "typespec-postgres/reference-without-key",
        message: "Can not reference 'Foo' automatically because it does not have a @key",
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
        message: "Can not manually create array references in the property 'fooArray'",
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
        message: "Can not manually create array references in the property 'fooArray'",
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