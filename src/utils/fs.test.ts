import { readdir } from "node:fs/promises";
import path from "node:path";
import { globby } from "globby";
import { beforeEach, describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { copyDir, remove, tempDir } from "./fs";

beforeEach(async (ctx) => {
    const temp = await tempDir();

    ctx.workdir = temp;

    return async () => {
        await remove(temp);
    };
});

describe.concurrent("copyDir", () => {
    it("should copy dir", async (ctx) => {
        const p = fixture("fs_copy_dir");
        const target = path.join(ctx.workdir, "target");
        await copyDir(p, target);
        expect(await readdir(target)).toEqual(await readdir(p));
    });

    it("should copy dir with filter", async (ctx) => {
        const p = fixture("fs_copy_dir");
        const target = path.join(ctx.workdir, "target");

        const files = await globby("**/3.txt", {
            cwd: p,
            dot: true,
            onlyFiles: false,
            gitignore: true,
            absolute: true,
        });

        await copyDir(p, target, (source, _) => {
            if (source === p) {
                return true;
            }

            return files[0].includes(source);
        });

        const files2 = await globby("**", {
            cwd: target,
            dot: true,
            onlyFiles: false,
            gitignore: true,
            absolute: false,
        });

        expect(files2).toContain(path.join("bar", "baz", "3.txt"));
    });

    // see: https://github.com/nodejs/node/pull/53534
    it.skip("should copy dir with dir already exists", async (ctx) => {
        const p = fixture("fs_copy_dir");
        const target = path.join(ctx.workdir, "target");
        const ps = Array.from({ length: 100 }).fill(0).map(() => copyDir(p, target));
        await Promise.all(ps);
    });
});
