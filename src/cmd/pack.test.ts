import path from "node:path";
import * as tar from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { copyDir, exists, move, remove, tempDir } from "../utils/fs";
import { pack, prePack } from "./pack";

afterEach(async (ctx) => {
    if (ctx.workdir) {
        await remove(ctx.workdir);
    }
});

describe("prePack", () => {
    it("should success", async (ctx) => {
        const p = fixture("prepack_success");

        ctx.workdir = await prePack(p, []);

        await expect(exists(ctx.workdir)).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package"))).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package.json"))).resolves.toBe(true);
    });

    it("should ignore node_modules", async (ctx) => {
        const p = fixture("prepack_ignore");

        ctx.workdir = await prePack(p, [
            "node_modules",
        ]);

        await expect(exists(ctx.workdir)).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package"))).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package.json"))).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package", "node_modules"))).resolves.toBe(false);
    });

    it("should support .gitignore", async (ctx) => {
        const _p = fixture("prepack_git_ignore");
        const p = await tempDir();

        ctx.onTestFinished(async () => {
            await remove(p);
        });

        await copyDir(_p, p);
        await move(path.join(p, "_gitignore"), path.join(p, ".gitignore"));

        ctx.workdir = await prePack(p, [
            "node_modules",
            ".oo-thumbnail.json",
        ]);

        await expect(exists(ctx.workdir)).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package"))).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package.json"))).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package", ".oo-thumbnail.json"))).resolves.toBe(true);
        await expect(exists(path.join(ctx.workdir, "package", "node_modules"))).resolves.toBe(false);
        await expect(exists(path.join(ctx.workdir, "package", "foo.txt"))).resolves.toBe(false);
    });
});

describe("pack", () => {
    it("should success", async () => {
        const p = fixture("pack_success");

        const tgz = path.join(p, "pack_success-0.0.1.tgz");

        await remove(tgz);
        await pack(p, p);
        await expect(exists(tgz)).resolves.toBe(true);

        {
            const result: string[] = [];
            await tar.t({
                f: tgz,
                onReadEntry: (entry) => {
                    result.push(entry.path.replaceAll("\\", "/"));
                },
            });
            expect(result).toContainEqual("package/package/.gitignore");
        }
        await remove(tgz);
    });

    it("should not ignore .oo-thumbnail.json", async (ctx) => {
        const _p = fixture("pack_ignore");
        const p = await tempDir();

        ctx.onTestFinished(async () => {
            await remove(p);
        });

        await copyDir(_p, p);
        await move(path.join(p, "_gitignore"), path.join(p, ".gitignore"));

        const tgz = path.join(p, "pack_ignore-0.0.1.tgz");
        await remove(tgz);
        await pack(p, p);

        await expect(exists(tgz)).resolves.toBe(true);

        {
            const result: string[] = [];
            await tar.t({
                f: tgz,
                onReadEntry: (entry) => {
                    result.push(entry.path.replaceAll("\\", "/"));
                },
            });

            expect(result).toContainEqual("package/package/.oo-thumbnail.json");
        }
        await remove(tgz);
    });
});
