import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import fs from "fs";
const pathPrefix = './test/assets/namespaces/';

describe("Namespaces", () => {
    it("Should allow different tables in different namespaces to have the same name in the entity decorator", async () => {
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
        );

        const filePath = pathPrefix + "name-collision.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Should handle nested namespaces without @entity decorators if options to emit are set", async () => {
        const res = await sqlFor(
            `
        namespace one {
            namespace two {
                namespace three {
                    model Foo {
                        myId: string
                    };
                }
            }
        }

        namespace this.can.be.very.nested.thing {
            model Foo {
                myId: string
            };
        }

        namespace two {
            model Foo {
            myId: string
            };
        }
        
        model Foo {
            myId: string
        };
        `, undefined, { "emit-non-entity-types": true });

        const filePath = pathPrefix + "nested-without-decorator.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Should handle nested namespaces", async () => {
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
        );

        const filePath = pathPrefix + "nested.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Should handle references to nested enums", async () => {
        const res = await sqlFor(
            `
        namespace one {
            namespace two {
                namespace three {
                    @entity("MyEnum") enum Foo2 {
                        "test", "test2"
                    };
                }
            }
        }

        @entity("Foo") model Nested {
            myEnumValue: one.two.three.Foo2
        };
        `
        );

        const filePath = pathPrefix + "nested-enum-reference.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Should not throw an error if entity name is assigned in different namespaces", async () => {
        const res = await sqlFor(
            `
          namespace one {
            @entity("Foo") enum Foo2 {
                "a", "b", "c"
              };
            @entity("Test") enum Test2 {
                "a", "b", "c"
            };
          }
          namespace two {
            @entity() enum Foo {
                "a", "b", "c"
            };
            @entity() enum Test {
                "a", "b", "c"
            };
          }
          `
        );

        const filePath = pathPrefix + "nested-entity-name.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");

        strictEqual(res, expectedSQL);
    });

    it("Should throw an error if an entity name collides with a namespace name", async () => {
        const diagnostics = await diagnoseSQLFor(
            `
          namespace one {
            @entity("Foo") enum Foo2 {
                "a", "b", "c"
              };
          }
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

    it("Should throw an error if a namespace name is a reserved word", async () => {
        const diagnostics = await diagnoseSQLFor(
            `
          namespace all {
            @entity() enum Foo {
                "a", "b", "c"
              };
          }
          `
        );

        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/reserved-entity-name",
                message: "Can not create the entity 'all' as its name is a reserved keyword in PostgreSQL",
            },
        ]);
    });

    it("Should throw an error if name of an entity is too long", async () => {
        const diagnostics = await diagnoseSQLFor(
            `
          namespace thisAlreadyHasALotOfWords {
            @entity("andThisWillMakeTheNameBe64CharsLong123") enum Foo {
                "a", "b", "c"
              };
          }
          `
        );

        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/entity-name-too-long",
                message: "The name 'thisAlreadyHasALotOfWords.andThisWillMakeTheNameBe64CharsLong123' is too long for a PostgreSQL entity",
            },
        ]);
    });

    it("Should throw a warning on a namespace collisions with table names", async () => {
        const code = `
        // as these have the schema as a prefix this is allowed
        namespace one.two {
          @entity()
          model test {
            someProp: numeric
          }
        }
        @entity()
        model one_two {
            someProp: numeric
        }`;
        const diagnostics = await diagnoseSQLFor(code);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/namespace-name-collision",
                message: "The name of the namespace 'two' is colliding with another entity and therefore renamed.",
                severity: "warning"
            },
        ]);
        const res = await sqlFor(code, undefined, undefined, true);
        const filePath = pathPrefix + "namespace-collision.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Should throw a warning on namespaces colliding with each other", async () => {
        const code = `
        // as these have the schema as a prefix this is allowed
        namespace one.two {
          @entity()
          model InsideNested {
            someProp: numeric
          }
        }
        namespace one_two {
            @entity()
            model OneLevel {
              someProp: numeric
            }
          }
        `;
        const diagnostics = await diagnoseSQLFor(code);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/namespace-name-collision",
                message: "The name of the namespace 'one_two' is colliding with another entity and therefore renamed.",
                severity: "warning"
            },
        ]);
        const res = await sqlFor(code, undefined, undefined, true);
        const filePath = pathPrefix + "namespaces-colliding.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });
});