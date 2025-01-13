import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { fixture } from "../../tests/helper/fs";
import { remove, tempDir, writeFile } from "./fs";
import { generatePackageJson, transformNodeModules } from "./npm";

beforeEach(async (ctx) => {
    const temp = await tempDir();

    ctx.workdir = temp;

    return async () => {
        await remove(temp);
    };
});

describe.concurrent("generatePackageJson", () => {
    it("should throw error when not found package.oo.yaml", async (ctx) => {
        await expect(generatePackageJson(ctx.workdir)).rejects.toThrow("Not found");
    });

    it("should throw error when miss name in package.oo.yaml", async (ctx) => {
        await writeFile(path.join(ctx.workdir, "package.oo.yaml"), "version: 1.0.0");
        await expect(generatePackageJson(ctx.workdir)).rejects.toThrow("Miss required field: name");
    });

    it("should throw error when miss version in package.oo.yaml", async (ctx) => {
        await writeFile(path.join(ctx.workdir, "package.oo.yaml"), "name: foo");
        await expect(generatePackageJson(ctx.workdir)).rejects.toThrow("Miss required field: version");
    });

    it("should generate package.json content", async (ctx) => {
        const content = {
            name: "test",
            version: "1.0.0",
            author: "Kevin Cui <bh@bugs.cc>",
            description: "A test package",
            keywords: ["test", "package"],
            icon: "./icon.png",
            dependencies: {
                foo: "1.0.0",
                bar: "1.0.0",
            },
        };
        const doc = new YAML.Document(content);
        await writeFile(path.join(ctx.workdir, "package.oo.yaml"), String(doc));

        const result = JSON.parse(await generatePackageJson(ctx.workdir));

        expect(result).toEqual({
            ...content,
            scripts: {},
            icon: `./${path.join("package", "icon.png")}`,
            files: [
                "package",
                "package/.gitignore",
            ],
        });
    });

    it("should not change icon when not starts with ./", async (ctx) => {
        const content = {
            name: "test",
            version: "1.0.0",
            icon: ":coffee:",
        };
        const doc = new YAML.Document(content);
        await writeFile(path.join(ctx.workdir, "package.oo.yaml"), String(doc));

        const result = await generatePackageJson(ctx.workdir, false);

        expect(result).toEqual({
            ...content,
            scripts: {},
            files: [
                "package",
                "package/.gitignore",
            ],
        });
    });
});

describe.concurrent("transformNodeModules", () => {
    it("should transform node_modules", async () => {
        const workdir = fixture("transform_node_modules_normal");

        const result = await transformNodeModules(workdir);

        expect(new Set(result)).toEqual(new Set([
            {
                source: path.join(workdir, "node_modules", "bar", "package"),
                name: "bar",
                version: "0.0.1",
            },
            {
                source: path.join(workdir, "node_modules", "baz", "package"),
                name: "baz",
                version: "0.0.1",
            },
            {
                source: path.join(workdir, "node_modules", "foo", "package"),
                name: "foo",
                version: "0.0.2",
            },
            {
                source: path.join(workdir, "node_modules", "qux", "package"),
                name: "qux",
                version: "0.0.1",
            },
            {
                source: path.join(workdir, "node_modules", "baz", "node_modules", "sub_a", "package"),
                name: "sub_a",
                version: "0.0.1",
            },
        ]));
    });
});
