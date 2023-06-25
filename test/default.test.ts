import { sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import fs from "fs";
const pathPrefix = './test/assets/default/';

describe("Default Values", () => {

    // Check everything works fine
    it("Should handle basic default values", async () => {
        const res = await sqlFor(`
            enum MyEnum {
                "test1", "test2", "test3"
            };
            
            @entity()
            model products {
                product_no?: int32 = 20;
                something?: boolean = false;
                @maxLength(100)
                name?: string = "text";
                price?: numeric = 9.99;
                enumValue?: MyEnum = MyEnum.test1;
            };
        `);
        const filePath = pathPrefix + "default.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });
});