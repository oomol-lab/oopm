import type { IDepMap } from "../types";
import path from "node:path";
import { walk } from "../utils/fs";
import { getDependencies } from "../utils/npm";

export async function list(workdir: string, searchDir: string) {
    searchDir = path.resolve(searchDir);

    const rootDeps = await getDependencies(workdir);

    const map: IDepMap = new Map();

    const ps = Object.entries(rootDeps).map(async ([name, version]) => {
        return await walk(name, version, searchDir, map);
    });

    await Promise.all(ps);

    return Array.from(map.values());
}
