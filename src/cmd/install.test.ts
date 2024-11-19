import path from "node:path";
import fg from "fast-glob";
import { beforeEach, describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { Registry } from "../../tests/helper/registry";
import { ooPackageName } from "../const";
import { copyDir, exists, remove, tempDir } from "../utils/fs";
import { generatePackageJson } from "../utils/npm";
import { install } from "./install";
import { publish } from "./publish";

beforeEach(async (ctx) => {
    ctx.workdir = await tempDir();
    ctx.registry = await Registry.create();

    return async () => {
        await ctx.registry.close();
        await remove(ctx.workdir);
    };
});

describe.sequential("install file", () => {
    it("should success with tar", async (ctx) => {
        const p = fixture("install_file_tar");

        const folderName = "install_file_tar-0.0.1";
        const tgz = path.join(p, `${folderName}.tgz`);

        const result = await install({
            file: tgz,
            distDir: ctx.workdir,
        });

        expect(result).toEqual({
            target: path.join(ctx.workdir, folderName),
            meta: await generatePackageJson(path.join(ctx.workdir, folderName), false),
            isOverwrite: false,
        });

        expect(await exists(path.join(ctx.workdir, folderName, ooPackageName))).toBe(true);

        const fileList = await fg.glob("**/*", {
            cwd: path.join(ctx.workdir, folderName),
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "package.oo.yaml",
            "src/index.ts",
        ]));

        {
            const result = await install({
                file: tgz,
                distDir: ctx.workdir,
            });

            expect(result).toEqual({
                target: path.join(ctx.workdir, folderName),
                meta: await generatePackageJson(path.join(ctx.workdir, folderName), false),
                isOverwrite: true,
            });
        }
    });

    it("should failed with not exists tar", async (ctx) => {
        expect(install({
            file: path.join(ctx.workdir, "not-exists.tgz"),
            distDir: ctx.workdir,
        })).rejects.toThrow("File not found: ");
    });

    it("should success with dir", async (ctx) => {
        const p = fixture("install_file_dir");

        const result = await install({
            file: p,
            distDir: ctx.workdir,
        });

        const folderName = "install_file_dir-0.0.1";

        expect(result).toEqual({
            target: path.join(ctx.workdir, folderName),
            meta: await generatePackageJson(path.join(ctx.workdir, folderName), false),
            isOverwrite: false,
        });

        expect(await exists(path.join(ctx.workdir, folderName, ooPackageName))).toBe(true);

        const fileList = await fg.glob("**/*", {
            cwd: path.join(ctx.workdir, folderName),
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "package.oo.yaml",
        ]));

        {
            const result = await install({
                file: p,
                distDir: ctx.workdir,
            });

            expect(result).toEqual({
                target: path.join(ctx.workdir, folderName),
                meta: await generatePackageJson(path.join(ctx.workdir, folderName), false),
                isOverwrite: true,
            });
        }
    });
});

describe.sequential("install all", () => {
    it("should success", async (ctx) => {
        const p = fixture("install_all");

        // publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "c-0.0.2"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "e-0.0.1"), ctx.registry.endpoint, "fake-token"),
            ]);
        }

        // Copy `local_storage` to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await Promise.all([
                copyDir(path.join(localStorage, "c-0.0.1"), path.join(distDir, "c-0.0.1")),
                copyDir(path.join(localStorage, "e-0.0.1"), path.join(distDir, "e-0.0.1")),
            ]);
        }

        // Copy `entry` to workdir
        await copyDir(path.join(p, "entry"), ctx.workdir);

        const result = await install({
            all: true,
            token: "fake-token",
            workdir: ctx.workdir,
            distDir,
            registry: ctx.registry.endpoint,
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.1",
            "b-0.0.1",
            "c-0.0.1",
        ]));

        expect(result.deps).toStrictEqual({
            "a-0.0.1": {
                name: "a",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "b-0.0.1": {
                name: "b",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "c-0.0.1": {
                name: "c",
                version: "0.0.1",
                isAlreadyExist: true,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "c-0.0.2": {
                name: "c",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "d-0.0.1": {
                name: "d",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "e-0.0.1": {
                name: "e",
                version: "0.0.1",
                isAlreadyExist: true,
                target: expect.any(String),
                meta: expect.any(Object),
            },
        });

        const fileList = await fg.glob(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.1/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
            "c-0.0.1/package.oo.yaml",
            "c-0.0.2/package.oo.yaml",
            "d-0.0.1/package.oo.yaml",
            "e-0.0.1/package.oo.yaml",
        ]));
    });
});

describe.sequential("install deps", () => {
    it("should success", async (ctx) => {
        const p = fixture("install_deps");

        // publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.2"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "c-0.0.1"), ctx.registry.endpoint, "fake-token"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token"),
            ]);
            await publish(path.join(remoteStorage, "b-0.0.2"), ctx.registry.endpoint, "fake-token");
        }

        // Copy `local_storage` to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await copyDir(path.join(localStorage, "a-0.0.1"), path.join(distDir, "a-0.0.1"));
        }

        // Copy `entry` to workdir
        await copyDir(path.join(p, "entry"), ctx.workdir);

        const result = await install({
            deps: [
                { name: "a" },
                { name: "b" },
                { name: "c", version: "0.0.1" },
            ],
            save: true,
            token: "fake-token",
            workdir: ctx.workdir,
            distDir,
            registry: ctx.registry.endpoint,
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.1",
            "b-0.0.2",
            "c-0.0.1",
        ]));

        expect(result.deps).toStrictEqual({
            "a-0.0.1": {
                name: "a",
                version: "0.0.1",
                isAlreadyExist: true,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "b-0.0.2": {
                name: "b",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "c-0.0.1": {
                name: "c",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
            "d-0.0.1": {
                name: "d",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
                meta: expect.any(Object),
            },
        });

        const deps = (await generatePackageJson(ctx.workdir, false)).dependencies;
        expect(deps).toEqual({
            a: "0.0.1",
            b: "0.0.2",
            c: "0.0.1",
            d: "0.0.1",
        });

        const fileList = await fg.glob(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.1/package.oo.yaml",
            "b-0.0.2/package.oo.yaml",
            "c-0.0.1/package.oo.yaml",
            "d-0.0.1/package.oo.yaml",
        ]));
    });
});

describe.sequential("unknown type", () => {
    it("should failed", async () => {
        // eslint-disable-next-line ts/ban-ts-comment
        // @ts-expect-error
        expect(install({})).rejects.toThrow("Invalid install options");
    });
});
