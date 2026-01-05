import path from "node:path";
import { globby } from "globby";
import { beforeEach, describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { Registry } from "../../tests/helper/registry";
import { ooPackageName } from "../const";
import { copyDir, exists, remove, tempDir } from "../utils/fs";
import { generatePackageJson, getDependencies } from "../utils/npm";
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
            isOverwrite: false,
        });

        expect(await exists(path.join(ctx.workdir, folderName, ooPackageName))).toBe(true);

        const fileList = await globby("**", {
            cwd: path.join(ctx.workdir, folderName),
            onlyFiles: true,
            absolute: false,
            dot: true,
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
                isOverwrite: true,
            });
        }
    });

    it("should failed with not exists tar", async (ctx) => {
        await expect(install({
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
            isOverwrite: false,
        });

        expect(await exists(path.join(ctx.workdir, folderName, ooPackageName))).toBe(true);

        const fileList = await globby("**", {
            cwd: path.join(ctx.workdir, folderName),
            onlyFiles: true,
            absolute: false,
            dot: true,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "package.oo.yaml",
            "foo.txt",
        ]));

        {
            const result = await install({
                file: p,
                distDir: ctx.workdir,
            });

            expect(result).toEqual({
                target: path.join(ctx.workdir, folderName),
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
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "c-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "f-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.3"), ctx.registry.endpoint, "fake-token", "public", "test"),
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
            searchDirs: [],
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.1",
            "b-0.0.1",
            "c-0.0.1",
            "f-0.0.1",
            "e-0.0.3",
        ]));

        expect(result.deps).toStrictEqual({
            "a-0.0.1": {
                name: "a",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "b-0.0.1": {
                name: "b",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "c-0.0.1": {
                name: "c",
                version: "0.0.1",
                isAlreadyExist: true,
                target: expect.any(String),
            },
            "c-0.0.2": {
                name: "c",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "d-0.0.1": {
                name: "d",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "e-0.0.1": {
                name: "e",
                version: "0.0.1",
                isAlreadyExist: true,
                target: expect.any(String),
            },
            "e-0.0.2": {
                name: "e",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "e-0.0.3": {
                name: "e",
                version: "0.0.3",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "f-0.0.1": {
                name: "f",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
        });

        const fileList = await globby("**", {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
            dot: true,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.1/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
            "c-0.0.1/package.oo.yaml",
            "c-0.0.2/foo.txt",
            "c-0.0.2/package.oo.yaml",
            "d-0.0.1/package.oo.yaml",
            "e-0.0.1/package.oo.yaml",
            "e-0.0.2/package.oo.yaml",
            "e-0.0.3/package.oo.yaml",
            "f-0.0.1/package.oo.yaml",
        ]));
    });

    it("should fail with cancel signal", async (ctx) => {
        const p = fixture("install_all");

        // publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "c-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "f-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.3"), ctx.registry.endpoint, "fake-token", "public", "test"),
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

        const controller = new AbortController();
        controller.abort();

        await expect(install({
            all: true,
            token: "fake-token",
            workdir: ctx.workdir,
            distDir,
            registry: ctx.registry.endpoint,
            cancelSignal: controller.signal,
            searchDirs: [],
        })).rejects.toThrow("This operation was aborted");
    });

    it("should install missing deps when exec integrity check", async (ctx) => {
        const p = fixture("install_all_integrity");

        // publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "c-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "f-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "g-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "h-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
        }

        // Copy `local_storage` to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await Promise.all([
                copyDir(path.join(localStorage, "a-0.0.1"), path.join(distDir, "a-0.0.1")),
                copyDir(path.join(localStorage, "b-0.0.1"), path.join(distDir, "b-0.0.1")),
                copyDir(path.join(localStorage, "c-0.0.1"), path.join(distDir, "c-0.0.1")),
                copyDir(path.join(localStorage, "e-0.0.1"), path.join(distDir, "e-0.0.1")),
                copyDir(path.join(localStorage, "f-0.0.1"), path.join(distDir, "f-0.0.1")),
                copyDir(path.join(localStorage, "h-0.0.1"), path.join(distDir, "h-0.0.1")),
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
            searchDirs: [],
        });

        const isAlreadyExistResult = Array.from(Object.values(result.deps)).filter(dep => dep.isAlreadyExist).map(d => `${d.name}-${d.version}`);

        expect(new Set(isAlreadyExistResult)).toEqual(new Set([
            "a-0.0.1",
            "b-0.0.1",
            "h-0.0.1",
        ]));

        const fileList = await globby(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.1/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
            "c-0.0.1/package.oo.yaml",
            "d-0.0.1/package.oo.yaml",
            "d-0.0.2/package.oo.yaml",
            "e-0.0.1/package.oo.yaml",
            "f-0.0.1/package.oo.yaml",
            "g-0.0.1/package.oo.yaml",
            "h-0.0.1/package.oo.yaml",
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
                publish(path.join(remoteStorage, "a-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "c-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
            await publish(path.join(remoteStorage, "b-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test");
        }

        // Copy `local_storage` to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await copyDir(path.join(localStorage, "a-0.0.1"), path.join(distDir, "a-0.0.1"));
            await copyDir(path.join(localStorage, "e-0.0.1"), path.join(distDir, "e-0.0.1"));
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
            searchDirs: [],
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.1",
            "b-0.0.2",
            "c-0.0.1",
        ]));

        // deps only returns the current installed dependencies and sub-dependencies
        // not the already existing dependencies
        expect(result.deps).toStrictEqual({
            "a-0.0.1": {
                name: "a",
                version: "0.0.1",
                isAlreadyExist: true,
                target: expect.any(String),
            },
            "b-0.0.2": {
                name: "b",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "c-0.0.1": {
                name: "c",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "d-0.0.1": {
                name: "d",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
        });

        const deps = (await getDependencies(ctx.workdir));
        expect(deps).toEqual({
            a: "0.0.1",
            b: "0.0.2",
            c: "0.0.1",
            d: "0.0.1",
            e: "0.0.1",
        });

        const fileList = await globby("**", {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
            dot: true,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.1/package.oo.yaml",
            "b-0.0.2/package.oo.yaml",
            "c-0.0.1/foo.txt",
            "c-0.0.1/package.oo.yaml",
            "d-0.0.1/package.oo.yaml",
            "e-0.0.1/package.oo.yaml",
        ]));
    });

    it("manually specifying the version should be the highest priority", async (ctx) => {
        const p = fixture("install_deps_priority");

        // Publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "a-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
        }

        // Create distDir
        const distDir = await tempDir();

        // Copy `entry` to workdir
        await copyDir(path.join(p, "entry"), ctx.workdir);

        const result = await install({
            deps: [
                {
                    name: "a",
                    version: "0.0.2",
                },
                {
                    name: "b",
                    version: "0.0.1",
                },
            ],
            save: true,
            token: "fake-token",
            workdir: ctx.workdir,
            distDir,
            registry: ctx.registry.endpoint,
            searchDirs: [],
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.2",
            "b-0.0.1",
        ]));

        expect(result.deps).toStrictEqual({
            "a-0.0.2": {
                name: "a",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "b-0.0.1": {
                name: "b",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
        });

        const deps = (await getDependencies(ctx.workdir));
        expect(deps).toEqual({
            a: "0.0.2",
            b: "0.0.1",
        });

        const fileList = await globby(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.2/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
        ]));
    });

    it("should install specified version when workdir is not specified", async (ctx) => {
        const p = fixture("install_deps_not_workdir");

        // Publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "a-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
        }

        // Create distDir
        const distDir = await tempDir();

        const result = await install({
            deps: [
                { name: "a", version: "0.0.2" },
                { name: "b", version: "0.0.1" },
            ],
            save: true,
            token: "fake-token",
            distDir,
            registry: ctx.registry.endpoint,
            searchDirs: [],
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.2",
            "b-0.0.1",
        ]));

        expect(result.deps).toStrictEqual({
            "a-0.0.2": {
                name: "a",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "b-0.0.1": {
                name: "b",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
        });

        const fileList = await globby(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.2/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
        ]));
    });

    it("should install specified version when package.oo.yaml is not found", async (ctx) => {
        const p = fixture("install_deps_not_package.oo.yaml");

        // Publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "a-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
        }

        // Create distDir and workDir
        const [distDir, workdir] = [await tempDir(), await tempDir()];

        const result = await install({
            deps: [
                { name: "a", version: "0.0.2" },
                { name: "b", version: "0.0.1" },
            ],
            save: true,
            token: "fake-token",
            workdir,
            distDir,
            registry: ctx.registry.endpoint,
            searchDirs: [],
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "a-0.0.2",
            "b-0.0.1",
        ]));

        expect(result.deps).toStrictEqual({
            "a-0.0.2": {
                name: "a",
                version: "0.0.2",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "b-0.0.1": {
                name: "b",
                version: "0.0.1",
                isAlreadyExist: false,
                target: expect.any(String),
            },
        });

        const fileList = await globby(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.2/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
        ]));

        expect(JSON.parse(await generatePackageJson(workdir))).toStrictEqual({
            name: path.basename(workdir),
            version: "0.0.1",
            files: expect.any(Array),
            scripts: {},
            dependencies: {
                a: "0.0.2",
                b: "0.0.1",
            },
        });
    });

    it("should install scoped package", async (ctx) => {
        const p = fixture("scoped_package_install");

        // publish scoped packages to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "@foo+bar-1.0.0"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "@foo+bar-2.0.0"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "@scope+other-1.0.0"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
        }

        // Copy local_storage to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await copyDir(path.join(localStorage, "@foo+bar-1.0.0"), path.join(distDir, "@foo+bar-1.0.0"));
        }

        // Copy entry to workdir
        await copyDir(path.join(p, "entry"), ctx.workdir);

        const result = await install({
            deps: [
                { name: "@foo/bar", version: "2.0.0" },
                { name: "@scope/other", version: "1.0.0" },
            ],
            save: true,
            token: "fake-token",
            workdir: ctx.workdir,
            distDir,
            registry: ctx.registry.endpoint,
            searchDirs: [],
        });

        expect(new Set(result.primaryDepNames)).toEqual(new Set([
            "@foo/bar-2.0.0",
            "@scope/other-1.0.0",
        ]));

        expect(result.deps).toStrictEqual({
            "@foo/bar-2.0.0": {
                name: "@foo/bar",
                version: "2.0.0",
                isAlreadyExist: false,
                target: expect.any(String),
            },
            "@scope/other-1.0.0": {
                name: "@scope/other",
                version: "1.0.0",
                isAlreadyExist: false,
                target: expect.any(String),
            },
        });

        const fileList = await globby(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "@foo+bar-1.0.0/package.oo.yaml",
            "@foo+bar-2.0.0/package.oo.yaml",
            "@scope+other-1.0.0/package.oo.yaml",
        ]));
    });

    it("should fail with cancel signal", async (ctx) => {
        const p = fixture("install_deps");

        // publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "c-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
            await publish(path.join(remoteStorage, "b-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test");
        }

        // Copy `local_storage` to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await copyDir(path.join(localStorage, "a-0.0.1"), path.join(distDir, "a-0.0.1"));
        }

        // Copy `entry` to workdir
        await copyDir(path.join(p, "entry"), ctx.workdir);

        const controller = new AbortController();
        controller.abort();

        await expect(install({
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
            cancelSignal: controller.signal,
            searchDirs: [],
        })).rejects.toThrow("This operation was aborted");
    });

    it("should install missing deps when exec integrity check in dep", async (ctx) => {
        const p = fixture("install_deps_integrity");

        // publish `remote_storage` to registry
        {
            const remoteStorage = path.join(p, "remote_storage");
            await Promise.all([
                publish(path.join(remoteStorage, "a-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "b-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "c-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "d-0.0.2"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "e-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "f-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "g-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
                publish(path.join(remoteStorage, "h-0.0.1"), ctx.registry.endpoint, "fake-token", "public", "test"),
            ]);
        }

        // Copy `local_storage` to distDir
        const distDir = await tempDir();
        {
            const localStorage = path.join(p, "local_storage");
            await Promise.all([
                copyDir(path.join(localStorage, "a-0.0.1"), path.join(distDir, "a-0.0.1")),
                copyDir(path.join(localStorage, "c-0.0.1"), path.join(distDir, "c-0.0.1")),
                copyDir(path.join(localStorage, "e-0.0.1"), path.join(distDir, "e-0.0.1")),
                copyDir(path.join(localStorage, "f-0.0.1"), path.join(distDir, "f-0.0.1")),
            ]);
        }

        // Copy `entry` to workdir
        await copyDir(path.join(p, "entry"), ctx.workdir);

        const result = await install({
            deps: [
                { name: "b" },
                { name: "h" },
            ],
            save: true,
            token: "fake-token",
            workdir: ctx.workdir,
            distDir,
            registry: ctx.registry.endpoint,
            searchDirs: [],
        });

        expect(new Set(Object.keys(result.deps))).toEqual(new Set([
            "h-0.0.1",
            "b-0.0.1",
            "d-0.0.1",
            "d-0.0.2",
            "g-0.0.1",
        ]));

        const fileList = await globby(`**/${ooPackageName}`, {
            cwd: distDir,
            onlyFiles: true,
            absolute: false,
        });

        expect(new Set(fileList)).toEqual(new Set([
            "a-0.0.1/package.oo.yaml",
            "b-0.0.1/package.oo.yaml",
            "c-0.0.1/package.oo.yaml",
            "d-0.0.1/package.oo.yaml",
            "d-0.0.2/package.oo.yaml",
            "e-0.0.1/package.oo.yaml",
            "f-0.0.1/package.oo.yaml",
            "g-0.0.1/package.oo.yaml",
            "h-0.0.1/package.oo.yaml",
        ]));
    });
});

describe.sequential("unknown type", () => {
    it("should failed", async () => {
        // eslint-disable-next-line ts/ban-ts-comment
        // @ts-expect-error
        await expect(install({})).rejects.toThrow("Invalid install options");
    });
});
