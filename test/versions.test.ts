import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
import fs from "fs";
const pathPrefix = './test/assets/versions/';

describe("versions tests", () => {
  it.skip("Check that basic versioning without migration scripts work", async () => {
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
      ["v1", "v2", "v3"], { "create-migrations-from-version": false }
    );
    const filePathV1 = pathPrefix + "basic-non-migration/v1.sql";
    const expectedSQLv1 = await readAndNormalize(filePathV1);
    const filePathV2 = pathPrefix + "basic-non-migration/v2.sql";
    const expectedSQLv2 = await readAndNormalize(filePathV2);
    const filePathV3 = pathPrefix + "basic-non-migration/v3.sql";
    const expectedSQLv3 = await readAndNormalize(filePathV3);

    strictEqual(v1, expectedSQLv1);
    strictEqual(v2, expectedSQLv2);
    strictEqual(v3, expectedSQLv3);
  });

  it.skip("Check that basic versioning without migration scripts work", async () => {
    const { v1, v2 } = await sqlFor(
      `
      @versioned(Versions)
      @service({title: "My Service"})
      namespace MyService {
        enum Versions {
          "v1",
          "v2",
        }
        @entity()
        model Test {
          prop1: string;
          @added(Versions.v2) prop2: string;
          @removed(Versions.v2) prop3: string;
        }
      }
    `,
      ["v1", "v2"]
    );
    const filePathV1 = pathPrefix + "simple-add-remove/v1.sql";
    const expectedSQLv1 = await readAndNormalize(filePathV1);
    const filePathV2 = pathPrefix + "simple-add-remove/v2.sql";
    const expectedSQLv2 = await readAndNormalize(filePathV2);

    strictEqual(v1, expectedSQLv1);
    strictEqual(v2, expectedSQLv2);
  });

  it("Check the addition of a single table in a new version", async () => {
    const { v1, v2 } = await sqlFor(
      `
      @versioned(Versions)
      @service({title: "My Service"})
      namespace MyService {
        enum Versions {
          "v1",
          "v2",
        }
        @entity()
        @added(Versions.v2)
        model TestAddedInTwo {
          prop1: string;
        }

        @entity()
        model TestAlwaysHere {
          prop1: string;
        }
      }
    `,
      ["v1", "v2"]
    );
    const filePathV1 = pathPrefix + "add-table/v1.sql";
    const expectedSQLv1 = await readAndNormalize(filePathV1);
    const filePathV2 = pathPrefix + "add-table/v2.sql";
    const expectedSQLv2 = await readAndNormalize(filePathV2);

    strictEqual(v1, expectedSQLv1);
    strictEqual(v2, expectedSQLv2);
  });

  /*
  TODO: write tests for all of the common cases
  added, 
  madeOptional, 
  removed, 
  renamedFrom, 
  typeChangedFrom, 
  
  returnTypeChangedFrom, (probably for operations etc - not for us)
  useDependency, 
  versioned
  */
});