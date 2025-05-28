import type { SearchDep } from "../types";
import path from "node:path";
import { exists } from "../utils/fs";
import { generatePackageJson, getDependencies } from "../utils/npm";

type IMap = Map<`${string}-${string}`, SearchDep>;

export async function list(workdir: string, searchDir: string) {
    searchDir = path.resolve(searchDir);

    const rootDeps = await getDependencies(workdir);

    const map: IMap = new Map();

    const ps = Object.entries(rootDeps).map(async ([name, version]) => {
        return await walk(name, version, searchDir, map);
    });

    await Promise.all(ps);

    return Array.from(map.values());
}

async function walk(name: string, version: string, searchDir: string, map: IMap) {
    const distDir = path.join(searchDir, `${name}-${version}`);

    const isExist = await exists(distDir);

    if (!isExist) {
        setMap(map, name, version);
        return;
    }

    setMap(map, name, version, distDir);

    // ---- search sub deps ----

    // ignore incorrect package. e.g:
    // - package.oo.yaml is not found
    // - package.oo.yaml is found but invalid
    const meta = await generatePackageJson(distDir, false)
        .catch(() => null);
    if (meta === null) {
        return;
    }

    const deps = meta.dependencies ?? {};

    const ps = Object.entries(deps).map(async ([name, version]) => {
        return await walk(name, version, searchDir, map);
    });

    await Promise.all(ps);
}

function setMap(map: IMap, name: string, version: string, distDir?: string) {
    const key = `${name}-${version}` as const;

    if (map.has(key)) {
        return;
    }

    if (distDir) {
        map.set(key, {
            name,
            version,
            distDir,
        });
    }
    else {
        map.set(key, {
            name,
            version,
            distDir: "",
        });
    }
}
