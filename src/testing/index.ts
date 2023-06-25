import { resolvePath } from "@typespec/compiler";
import { createTestLibrary, TypeSpecTestLibrary } from "@typespec/compiler/testing";
import { fileURLToPath } from "url";

export const SQLTestLibrary: TypeSpecTestLibrary = createTestLibrary({
  name: "typespec-postgres",
  packageRoot: resolvePath(fileURLToPath(import.meta.url), "../../../../"),
});