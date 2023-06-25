import { interpolatePath } from "@typespec/compiler";
import { HttpTestLibrary } from "@typespec/http/testing";
import { SQLTestLibrary } from "../src/testing/index.js";
import { OpenAPITestLibrary } from "@typespec/openapi/testing";
import { RestTestLibrary } from "@typespec/rest/testing";
import { VersioningTestLibrary } from "@typespec/versioning/testing";
import { OpenAPI3TestLibrary } from "@typespec/openapi3/testing";
import {
  createTestHost,
  expectDiagnosticEmpty,
  resolveVirtualPath,
} from "@typespec/compiler/testing";
import { SQLEmitterOptions } from "../src/lib.js";

export async function createSQLTestHost() {
  return createTestHost({
    libraries: [
      HttpTestLibrary,
      RestTestLibrary,
      VersioningTestLibrary,
      OpenAPITestLibrary,
      OpenAPI3TestLibrary,
      SQLTestLibrary,
    ],
  });
}

export async function diagnoseSQLFor(
  code: string,
  versions?: string[],
  options: SQLEmitterOptions = {}
) {
  const host = await createSQLTestHost();
  const outPath = resolveVirtualPath("{version}.openapi.sql");
  host.addTypeSpecFile(
    "./main.tsp", `
    import "@typespec/http";
    import "@typespec/rest";
    import "@typespec/openapi";
    import "typespec-postgres";
    import "@typespec/openapi3"; 
    ${versions ? `import "@typespec/versioning"; using TypeSpec.Versioning;` : ""}
    using TypeSpec.Rest;
    using TypeSpec.Http;
    using OpenAPI;
    using Postgres;
    ${code}`
  );
  const diagnostics = await host.diagnose("./main.tsp", {
    noEmit: false,
    emit: ["typespec-postgres"],
    options: { "typespec-postgres": { ...options, "output-file": outPath } },
  });
  return diagnostics.filter((x) => x.code !== "@typespec/http/no-routes");
}

export async function sqlFor(
  code: string,
  versions?: string[],
  options: SQLEmitterOptions = {},
  allowWarnings: boolean = false
) {
  const host = await createSQLTestHost();
  const outPath = resolveVirtualPath("{version}.openapi.sql");
  host.addTypeSpecFile(
    "./main.tsp", `
    import "@typespec/http";
    import "@typespec/rest";
    import "@typespec/openapi";
    import "typespec-postgres";
    import "@typespec/openapi3"; 
    ${versions ? `import "@typespec/versioning"; using TypeSpec.Versioning;` : ""}
    using TypeSpec.Rest;
    using TypeSpec.Http;
    using OpenAPI;
    using Postgres;
    ${code}`
  );
  // because that's how the sql-formatting works on windows
  options["new-line"] = options["new-line"] ?? 'crlf';
  let diagnostics = await host.diagnose("./main.tsp", {
    noEmit: false,
    emit: ["typespec-postgres"],
    options: { "typespec-postgres": { ...options, "output-file": outPath } },
  });
  if (allowWarnings) {
    diagnostics = diagnostics.filter(x => x.severity === "error");
  }
  expectDiagnosticEmpty(diagnostics.filter((x) => x.code !== "@typespec/http/no-routes"));

  if (!versions) {
    return host.fs.get(resolveVirtualPath("openapi.sql"))!;
  } else {
    const output: any = {};
    for (const version of versions) {
      output[version] = host.fs.get(interpolatePath(outPath, { version: version }))!;
    }
    return output;
  }
}