import { sqlFor } from "./test-host.js";
import { strictEqual } from "assert";
import fs from "fs";
const pathPrefix = './test/assets/examples/';

// test all examples from the TypeSpec playground
describe("examples", () => {

    it("Check the example Discriminated unions", async () => {
        const res = await sqlFor(`
        model WidgetBase {
            @key id: string;
            weight: int32;
            color: "red" | "blue";
        }

        enum WidgetKind {
            Heavy,
            Light,
        }

        @entity()
        model HeavyWidget extends WidgetBase {
            kind: WidgetKind.Heavy;
        }

        @entity()
        model LightWidget extends WidgetBase {
            kind: WidgetKind.Light;
        }

        @discriminator("kind")
        @oneOf
        union Widget {
            heavy: HeavyWidget,
            light: LightWidget,
        }
    `);
        const filePath = pathPrefix + "discriminator.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Test HTTP Service Example", async () => {
        const res = await sqlFor(`
        @service({
            title: "Widget Service",
            version: "1.0.0",
        })
        namespace DemoService;
        
        model Widget {
            @visibility("read", "update")
            @path
            id: string;
            weight: int32;
            color: "red" | "blue";
        }
        
        @error
        model Error {
            code: int32;
            message: string;
        }
        
        @route("/widgets")
        @tag("Widgets")
        interface Widgets {
            @get list(): Widget[] | Error;
            @get read(@path id: string): Widget | Error;
            @post create(...Widget): Widget | Error;
            @patch update(...Widget): Widget | Error;
            @delete delete(@path id: string): void | Error;
            @route("{id}/analyze") @post analyze(@path id: string): string | Error;
        }
        
    `, undefined, { "emit-non-entity-types": true });
        const filePath = pathPrefix + "http-service.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    it("Test Rest Framework example", async () => {
        const res = await sqlFor(`
        namespace DemoService;

        model Widget {
            @key id: string;
            weight: int32;
            color: "red" | "blue";
        }

        @error
        model Error {
            code: int32;
            message: string;
        }

        interface WidgetService extends Resource.ResourceOperations<Widget, Error> {
            @get @route("customGet") customGet(): Widget;
        }
    `, undefined, { "emit-non-entity-types": true });
        const filePath = pathPrefix + "rest-framework.sql";
        const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
        strictEqual(res, expectedSQL);
    });

    // TODO: (feature) allow n:m references
    // it.only("Check List Example", async () => {
    //     const res = await sqlFor(`
    //     @service({

    //     })
    //     namespace DemoService;

    //     model Widget {
    //         @key id: string;
    //         weight: int32;
    //         color: "red" | "blue";
    //     }

    //     model List<T> {
    //         value: T[];
    //         nextLink?: url,
    //     }

    //     @error
    //     model Error {
    //         code: int32;
    //         message: string;
    //     }

    //     interface WidgetService extends Resource.ResourceOperations<Widget, Error> {
    //         @get @route("customGet") customGet(): Widget;
    //         @get list(): List<Widget>
    //     }
    // `, undefined, { "emit-non-entity-types": true });
    //     const filePath = pathPrefix + "rest-framework.sql";
    //     const expectedSQL = await fs.promises.readFile(filePath, "utf-8");
    //     strictEqual(res, expectedSQL);
    // });
});