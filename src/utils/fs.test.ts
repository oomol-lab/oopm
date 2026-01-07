import type { IDepMap } from "../types";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { globby } from "globby";
import { beforeEach, describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { copyDir, exists, mkdir, remove, tempDir, walk } from "./fs";

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

describe("walk", () => {
    it("should walk scoped packages with nested dependencies", async () => {
        const p = fixture("scoped_package_with_deps");
        const localDir = path.join(p, "local_storage");
        const remoteDir = path.join(p, "remote_storage");

        const map: IDepMap = new Map();
        await walk("@scope/pkg", "1.0.0", [localDir, remoteDir], map);

        // Should find the scoped package
        expect(map.has("@scope/pkg-1.0.0")).toBe(true);
        expect(map.get("@scope/pkg-1.0.0")).toEqual({
            name: "@scope/pkg",
            version: "1.0.0",
            distDir: path.join(localDir, "@scope/pkg-1.0.0"),
        });

        // Should find the normal dependency
        expect(map.has("normal-dep-1.0.0")).toBe(true);
        expect(map.get("normal-dep-1.0.0")).toEqual({
            name: "normal-dep",
            version: "1.0.0",
            distDir: path.join(localDir, "normal-dep-1.0.0"),
        });

        // Should find the nested scoped dependency
        expect(map.has("@other/lib-1.0.0")).toBe(true);
        expect(map.get("@other/lib-1.0.0")).toEqual({
            name: "@other/lib",
            version: "1.0.0",
            distDir: path.join(remoteDir, "@other/lib-1.0.0"),
        });
    });

    it("should handle missing scoped packages", async () => {
        const p = fixture("scoped_package_with_deps");
        const localDir = path.join(p, "local_storage");

        const map: IDepMap = new Map();
        await walk("@nonexistent/pkg", "1.0.0", [localDir], map);

        expect(map.has("@nonexistent/pkg-1.0.0")).toBe(true);
        expect(map.get("@nonexistent/pkg-1.0.0")).toEqual({
            name: "@nonexistent/pkg",
            version: "1.0.0",
            distDir: "",
        });
    });
});

describe("mkdir with scoped paths", () => {
    it("should create nested directories for scoped packages", async (ctx) => {
        const scopedPath = path.join(ctx.workdir, "@scope/pkg-1.0.0");

        await mkdir(scopedPath);

        expect(await exists(scopedPath)).toBe(true);
        expect(await exists(path.join(ctx.workdir, "@scope"))).toBe(true);
    });
});

describe("exists with scoped paths", () => {
    it("should detect scoped package directories", async (ctx) => {
        const scopedPath = path.join(ctx.workdir, "@scope/pkg-1.0.0");

        expect(await exists(scopedPath)).toBe(false);

        await mkdir(scopedPath);

        expect(await exists(scopedPath)).toBe(true);
    });
});
