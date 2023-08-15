import { expectDiagnostics } from "@typespec/compiler/testing";
import { diagnoseSQLFor, sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import { readAndNormalize } from "./helper.js";
const pathPrefix = './test/assets/types/';

describe("Built-In Types", () => {
    it("Should correctly handle numeric types", async () => {
        const res = await sqlFor(`
            @entity()
            model NumericTypes {
                nu?: numeric;
                inType?: integer;
                flo?: float;
                in64?: int64;
                in32?: int32;
                in16?: int16;
                in8?: int8;
                safe?: safeint,
                uin64?: uint64;
                uin32?: uint32;
                uin16?: uint16;
                uin8?: uint8;
                flo32?: float32;
                flo64?: float64;
              }
              
        `);
        const filePath = pathPrefix + "numeric.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should correctly handle date and time types", async () => {
        const res = await sqlFor(`
            @entity()
            model TimeTypes {
                plainDat?: plainDate;
                plainTim?: plainTime;
                utcDateTim?: utcDateTime;
                offsetDateTim?: offsetDateTime;
                dur?: duration;
              }
              
        `);
        const filePath = pathPrefix + "time.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should work for byte and bool", async () => {
        const res = await sqlFor(`
            @entity()
            model ByteBool {
                byte?: bytes;
                bool?: boolean;
            }
        `);
        const filePath = pathPrefix + "byte-bool.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should correctly handle other types", async () => {
        const diagnostics = await diagnoseSQLFor(`
            @entity()
            model TimeTypes {
                nu: null; // also throws error in openAPI-Emitter
                unk?: unknown;
                vo?: void; // also throws error in openAPI-Emitter
                nev: never;
            }
        `);
        expectDiagnostics(diagnostics, [
            {
                code: "typespec-postgres/unsupported-type",
                message: "The type 'Intrinsic' is not supported"
            },
            {
                code: "typespec-postgres/unsupported-type",
                message: "The type 'Intrinsic' is not supported"
            },
            {
                code: "typespec-postgres/unsupported-type",
                message: "The type 'Intrinsic' is not supported"
            },
            {
                code: "typespec-postgres/unsupported-type",
                message: "The type 'Intrinsic' is not supported"
            },
        ]);
    });

    it("Should handle record type", async () => {
        const res = await sqlFor(`
            @entity()
            model RecordHolder {
                obj: Record<unknown>
            }
        `);
        const filePath = pathPrefix + "record.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    it("Should handle arrays Record type", async () => {
        const res = await sqlFor(`
            @entity()
            model RecordHolder {
                obj: Record<unknown>[]
            }
        `);
        const filePath = pathPrefix + "record-array.sql";
        const expectedSQL = await readAndNormalize(filePath)
        strictEqual(res, expectedSQL);
    });

    // FIXME: add more tests for record types that are known!
});