import { beforeEach, describe, expect, it } from "vitest";
import { fixture, listFilesWithBase64Tar } from "../../tests/helper/fs";
import { Registry } from "../../tests/helper/registry";
import { ERR_OOPM_DEPEND_ITSELF } from "../const";
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
        const data = await publish(p, ctx.registry.endpoint, "fake_token", "public", "test");
        expect(data.version).toBe("0.0.1");

        const data2 = ctx.registry.getData("publish_success", "0.0.1");
        expect(new Set(await listFilesWithBase64Tar(data2))).toEqual(new Set([
            "package/package.json",
            "package/package/package.json",
            "package/package/src/index.ts",
            "package/package/package.oo.yaml",
        ]));
    });

    it("should success for update package", async (ctx) => {
        {
            const p = fixture("publish_new_success");
            const data = await publish(p, ctx.registry.endpoint, "fake_token", "public", "test");
            expect(data.version).toBe("0.0.1");
        }

        {
            const p = fixture("publish_update_success");
            const data = await publish(p, ctx.registry.endpoint, "fake_token", "public", "test");
            expect(data.version).toBe("0.0.2");
        }

        const data = ctx.registry.getData("publish_success", "0.0.2");
        expect(new Set(await listFilesWithBase64Tar(data))).toEqual(new Set([
            "package/package.json",
            "package/package/package.json",
            "package/package/src/main.ts",
            "package/package/package.oo.yaml",
        ]));
    });

    it("should failed when depend itself", async (ctx) => {
        const p = fixture("publish_depend_itself");

        await expect(
            publish(p, ctx.registry.endpoint, "fake_token", "public", "test"),
        ).rejects.toThrow(ERR_OOPM_DEPEND_ITSELF);
    });
});
