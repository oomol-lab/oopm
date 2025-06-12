import type { SearchDep } from "../types";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { list } from "./list";

describe("list", () => {
    it("should list all dependencies", async () => {
        const p = fixture("list_normal");

        const entryDir = path.join(p, "entry");
        const localDir = path.join(p, "local_storage");
        const localDir2 = path.join(p, "local_storage_2");

        const result = await list(entryDir, [localDir, localDir2]);

        expect(result.length).toBe(14);

        {
            const a = result.filter(r => r.name.startsWith("a"));
            expect(a.sort(sortDeps)).toStrictEqual([
                {
                    name: "a1",
                    version: "0.0.1",
                    distDir: expect.any(String),
                },
                {
                    name: "a2",
                    version: "0.0.1",
                    distDir: expect.any(String),
                },
                {
                    name: "a3",
                    version: "0.0.2",
                    distDir: expect.any(String),
                },
                {
                    name: "a4",
                    version: "0.0.1",
                    distDir: expect.any(String),
                },
                {
                    name: "a5",
                    version: "0.0.3",
                    distDir: expect.any(String),
                },
            ]);
        }

        {
            const b = result.filter(r => r.name.startsWith("b"));
            expect(b.sort(sortDeps)).toStrictEqual([
                {
                    name: "b1",
                    version: "0.0.1",
                    distDir: expect.any(String),
                },
                {
                    name: "b2",
                    version: "0.0.1",
                    distDir: expect.any(String),
                },
                {
                    name: "b2",
                    version: "0.0.2",
                    distDir: expect.any(String),
                },
                {
                    name: "b3",
                    version: "0.0.2",
                    distDir: expect.any(String),
                },
                {
                    name: "b4",
                    version: "0.0.1",
                    distDir: expect.any(String),
                },
            ].sort(sortDeps));
        }

        {
            const c = result.filter(r => r.name.startsWith("c"));
            expect(c.sort(sortDeps)).toStrictEqual([
                {
                    name: "c1",
                    version: "0.0.1",
                    distDir: "",
                },
                {
                    name: "c2",
                    version: "0.0.2",
                    distDir: "",
                },
                {
                    name: "c3",
                    version: "0.0.2",
                    distDir: path.join(localDir2, "c3-0.0.2"),
                },
                {
                    name: "c4",
                    version: "0.0.1",
                    distDir: "",
                },
            ].sort(sortDeps));
        }
    });
});

function sortDeps(a: SearchDep, b: SearchDep) {
    if (a.name === b.name) {
        return a.version.localeCompare(b.version);
    }

    return a.name.localeCompare(b.name);
}
