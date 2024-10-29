import { beforeEach, describe, expect, it } from "vitest";
import { fixture, listFilesWithBase64Tar } from "../../tests/helper/fs";
import { Registry } from "../../tests/helper/registry";
import { publish } from "./publish";

beforeEach(async (ctx) => {
    ctx.registry = await Registry.create();
    process.env.CUSTOM_REGISTRY = ctx.registry.endpoint;

    return async () => {
        await ctx.registry.close();
    };
});

describe.sequential("publish", () => {
    it("should success for new package", async (ctx) => {
        const p = fixture("publish_new_success");
        await expect(publish(p, "fake_token")).resolves.toBeUndefined();

        const data = ctx.registry.getData("publish_success", "0.0.1");
        expect(new Set(await listFilesWithBase64Tar(data))).toEqual(new Set([
            "package/package.json",
            "package/package/package.json",
            "package/package/src/index.ts",
            "package/package/package.oo.yaml",
        ]));
    });

    it("should success for update package", async (ctx) => {
        {
            const p = fixture("publish_new_success");
            await expect(publish(p, "fake_token")).resolves.toBeUndefined();
        }

        {
            const p = fixture("publish_update_success");
            await expect(publish(p, "fake_token")).resolves.toBeUndefined();
        }

        const data = ctx.registry.getData("publish_success", "0.0.2");
        expect(new Set(await listFilesWithBase64Tar(data))).toEqual(new Set([
            "package/package.json",
            "package/package/package.json",
            "package/package/src/main.ts",
            "package/package/package.oo.yaml",
        ]));
    });
});
