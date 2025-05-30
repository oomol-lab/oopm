import type { Dep, DepRaw, Deps, IDepMap, InstallAllResult, InstallFileResult, InstallPackageResult, SearchDep } from "../types";
import path from "node:path";
import { execa } from "execa";
import pLimit from "p-limit";
import { ooPackageName, ooThumbnailName } from "../const";
import { copyDir, exists, mkdir, move, remove, tempDir, walk, xTar } from "../utils/fs";
import { env } from "../utils/misc";
import {
    findLatestVersion,
    generatePackageJson,
    getDependencies,
    initPackageJson,
    transformNodeModules,
    updateDependencies,
} from "../utils/npm";

export interface InstallBasicOptions {
    distDir: string;

    cancelSignal?: AbortSignal;
}

export interface InstallAllOptions extends InstallBasicOptions {
    all: true;
    workdir: string;
    token?: string;
    registry: string;
}

export interface InstallFileOptions extends InstallBasicOptions {
    file: string;
}

export interface InstallPackageOptions extends InstallBasicOptions {
    workdir?: string;
    deps: DepRaw[];
    token?: string;
    save: boolean;
    registry: string;
}

export type InstallOptions = InstallAllOptions | InstallFileOptions | InstallPackageOptions;

export async function install(options: InstallAllOptions): Promise<InstallAllResult>;
export async function install(options: InstallPackageOptions): Promise<InstallPackageResult>;
export async function install(options: InstallFileOptions): Promise<InstallFileResult>;
export async function install(options: InstallOptions): Promise<InstallFileResult | InstallPackageResult | InstallAllResult> {
    if ("file" in options) {
        return await installFile(options);
    }

    if ("deps" in options) {
        return await installPackage(options);
    }

    if ("all" in options) {
        return await installAll(options);
    }

    throw new Error("Invalid install options");
}

// oopm install ../../foo.tgz
// oopm install ../../bar/
// In this scenario, we do not handle any dependencies (no dependencies installed).
export async function installFile(options: InstallFileOptions): Promise<InstallFileResult> {
    if (!await exists(options.file)) {
        throw new Error(`File not found: ${options.file}`);
    }

    const isTarball = options.file.endsWith(".tgz");

    if (isTarball) {
        const tempDir = await xTar(options.file);
        const meta = await generatePackageJson(tempDir, false);
        const targetDir = path.join(options.distDir, `${meta.name}-${meta.version}`);
        const isExists = await exists(targetDir);
        if (isExists) {
            await remove(targetDir);
        }
        await mkdir(path.dirname(targetDir));
        await move(tempDir, targetDir);
        await remove(path.join(targetDir, ooThumbnailName));
        return {
            target: targetDir,
            meta,
            isOverwrite: isExists,
        };
    }

    const meta = await generatePackageJson(options.file, false);
    const targetDir = path.join(options.distDir, `${meta.name}-${meta.version}`);
    const isExists = await exists(targetDir);
    if (isExists) {
        await remove(targetDir);
    }
    await mkdir(path.dirname(targetDir));
    await copyDir(options.file, targetDir, installFilter);
    return {
        target: targetDir,
        meta,
        isOverwrite: isExists,
    };
}

// oopm install foo
// oopm install foo@1.0.0
export async function installPackage(options: InstallPackageOptions): Promise<InstallPackageResult> {
    const dependencies = await getDependencies(options.workdir);

    const primaryDepNames: InstallPackageResult["primaryDepNames"] = [];
    const alreadyInstalled: Deps = [];
    const needInstall: Deps = [];

    // Searching for dependencies that need to be installed and those that have already been installed.
    {
        const p = options.deps.map(async (dep) => {
            let version = dep.version;

            if (!version) {
                if (dependencies?.[dep.name]) {
                    version = dependencies?.[dep.name] as string;
                }
                else {
                    version = await findLatestVersion(dep.name, options.registry, options.token);
                }
            }

            primaryDepNames.push(`${dep.name}-${version}`);

            const existsDisk = await exists(path.join(options.distDir, `${dep.name}-${version}`, ooPackageName));
            if (existsDisk && dependencies?.[dep.name] === version) {
                alreadyInstalled.push({
                    name: dep.name,
                    version,
                });
            }
            else {
                needInstall.push({
                    name: dep.name,
                    version,
                });
            }
        });

        Object.keys(dependencies).forEach((key) => {
            // If there is a dependency, skip it
            // Because it is manually specified by the user, it has the highest priority
            if (options.deps.some(dep => dep.name === key)) {
                return;
            }

            p.push((async (key) => {
                const dep: Dep = {
                    name: key,
                    version: dependencies![key],
                };

                const existsDisk = await exists(path.join(options.distDir, `${dep.name}-${dep.version}`, ooPackageName));
                if (!existsDisk) {
                    needInstall.push(dep);
                }
            })(key));
        });

        await Promise.all(p);
    }

    // We only check deps that have not changed
    const needCheckIntegrityDeps = Object.entries(dependencies)
        .map(([name, version]) => ({ name, version }))
        .filter((dep) => {
            return !needInstall.some(n => n.name === dep.name);
        });

    const deps = await _install({
        alreadyInstalled,
        needInstall,
        save: options.save,
        workdir: options.workdir,
        distDir: options.distDir,
        token: options.token,
        registry: options.registry,
        needCheckIntegrityDeps,

        cancelSignal: options.cancelSignal,
    });

    return {
        deps,
        primaryDepNames,
    };
}

// oopm install
export async function installAll(options: InstallAllOptions): Promise<InstallAllResult> {
    const dependencies = await getDependencies(options.workdir);
    const primaryDepNames: InstallAllResult["primaryDepNames"] = [];

    const alreadyInstalled: Deps = [];
    const needInstall: Deps = [];

    {
        const p = Object.keys(dependencies).map(async (key) => {
            const dep: Dep = {
                name: key,
                version: dependencies![key],
            };

            const existsDisk = await exists(path.join(options.distDir, `${dep.name}-${dep.version}`, ooPackageName));
            if (existsDisk) {
                alreadyInstalled.push(dep);
            }
            else {
                needInstall.push(dep);
            }

            primaryDepNames.push(`${dep.name}-${dep.version}`);
        });

        await Promise.all(p);
    }

    const deps = await _install({
        alreadyInstalled,
        needInstall,
        save: false,
        workdir: options.workdir,
        distDir: options.distDir,
        token: options.token,
        registry: options.registry,
        needCheckIntegrityDeps: Object.entries(dependencies).map(([name, version]) => ({ name, version })),

        cancelSignal: options.cancelSignal,
    });

    return {
        deps,
        primaryDepNames,
    };
}

interface _InstallOptions {
    save: boolean;
    token?: string;
    workdir?: string;
    distDir: string;
    alreadyInstalled: Deps;
    needInstall: Deps;
    registry: string;

    needCheckIntegrityDeps: Deps;

    cancelSignal?: AbortSignal;
}

async function _install(options: _InstallOptions): Promise<InstallPackageResult["deps"]> {
    const temp = await tempDir();
    await initPackageJson(temp, options.needInstall, options.registry, options.token);

    await execa({
        cwd: temp,
        env: env(options.registry),
        cancelSignal: options.cancelSignal,
        forceKillAfterDelay: 1000,
    })`npm install`;

    const info = await transformNodeModules(temp);

    await mkdir(options.distDir);

    const targets: InstallPackageResult["deps"] = {};

    for (const dep of options.alreadyInstalled) {
        const target = path.join(options.distDir, `${dep.name}-${dep.version}`);

        targets[`${dep.name}-${dep.version}`] = {
            name: dep.name,
            version: dep.version,
            target,
            isAlreadyExist: true,
            meta: await generatePackageJson(target, false),
        };
    }

    const ps = info
        .filter((i) => {
            if (options.alreadyInstalled.length === 0) {
                return true;
            }

            return options.alreadyInstalled.some((dep) => {
                return !(dep.name === i.name && dep.version === i.version);
            });
        })
        .map(async (i) => {
            const target = path.join(options.distDir, `${i.name}-${i.version}`);
            const isAlreadyExist = await exists(target);

            targets[`${i.name}-${i.version}`] = {
                name: i.name,
                version: i.version,
                target,
                isAlreadyExist,
                meta: await generatePackageJson(i.source, false),
            };

            if (!isAlreadyExist) {
                return copyDir(i.source, target, installFilter);
            }
        });

    if (options.save && options.workdir) {
        await updateDependencies(options.workdir, options.needInstall);
    }

    await Promise.all(ps);

    await remove(temp);

    {
        const tempDistDir = await tempDir();
        try {
            const searchDeps = await integrityCheck(options, tempDistDir);
            const ps = searchDeps.map(async (dep) => {
                const fullName = `${dep.name}-${dep.version}` as const;
                if (targets[fullName]) {
                    return;
                }

                const target = path.join(options.distDir, `${dep.name}-${dep.version}`);
                await copyDir(dep.distDir, target, installFilter);

                targets[fullName] = {
                    name: dep.name,
                    version: dep.version,
                    target,
                    isAlreadyExist: false,
                    meta: await generatePackageJson(target, false),
                };

                return Promise.resolve();
            });
            await Promise.all(ps);
        }
        finally {
            await remove(tempDistDir).catch();
        }
    }

    return targets;
}

function installFilter(src: string, _dest: string, source: string, _destination: string): boolean {
    return path.join(src, ooThumbnailName) !== source;
}

async function integrityCheck(options: _InstallOptions, tempDistDir: string): Promise<SearchDep[]> {
    if (options.needCheckIntegrityDeps.length === 0) {
        return [];
    }

    const map: IDepMap = new Map();
    {
        const ps = options.needCheckIntegrityDeps.map(async (dep) => {
            return await walk(dep.name, dep.version, options.distDir, map);
        });
        await Promise.all(ps);
    }

    const missDeps = Array.from(map.values()).filter((dep) => {
        return dep.distDir === "";
    });

    if (missDeps.length === 0) {
        return [];
    }

    const cleanDirs: string[] = [];
    const addedMap = new Map<`${string}-${string}`, SearchDep>();

    const installLimit = pLimit(5);
    const ps = group(missDeps).map((deps) => {
        return installLimit(async () => {
            const { tempDir, distDir, collectedDeps } = await installMissDep(deps, options);
            cleanDirs.push(tempDir);

            for (const i of collectedDeps) {
                addedMap.set(`${i.name}-${i.version}`, {
                    name: i.name,
                    version: i.version,
                    distDir: path.join(distDir, `${i.name}-${i.version}`),
                });
            }
        });
    });

    let newDeps: SearchDep[] = [];
    try {
        await Promise.all(ps);

        const moveLimit = pLimit(10);
        const movePs = Array.from(addedMap.values()).map((target) => {
            return moveLimit(async () => {
                const newTarget = path.join(tempDistDir, `${target.name}-${target.version}`);

                await move(target.distDir, newTarget);

                return {
                    name: target.name,
                    version: target.version,
                    distDir: newTarget,
                };
            });
        });

        newDeps = await Promise.all(movePs);
    }
    finally {
        for (const dir of cleanDirs) {
            await remove(dir).catch();
        }
    }

    return newDeps;
}

async function installMissDep(deps: Deps, options: _InstallOptions): Promise<{
    tempDir: string;
    distDir: string;
    collectedDeps: Deps;
}> {
    const temp = await tempDir();
    const distDir = path.join(temp, "oo-dist");
    await mkdir(distDir);

    await initPackageJson(temp, deps, options.registry, options.token);

    await execa({
        cwd: temp,
        env: env(options.registry),
        cancelSignal: options.cancelSignal,
        forceKillAfterDelay: 1000,
    })`npm install`;

    const info = await transformNodeModules(temp);

    const collectedDeps: Deps = [];

    for (const i of info) {
        const target = path.join(distDir, `${i.name}-${i.version}`);
        await move(i.source, target);
        collectedDeps.push({
            name: i.name,
            version: i.version,
        });
    }

    return {
        tempDir: temp,
        distDir,
        collectedDeps,
    };
}

// [{name: a, version: 1.0.0}, {name: b, version: 1.0.0}, {name: a, version: 2.0.0}]
// to
// [[{name: a, version: 1.0.0}, {name: b, version: 1.0.0}], [{name: a, version: 2.0.0}]]
function group(deps: Deps): Deps[] {
    const groupedDeps: Deps[] = [];

    for (const dep of deps) {
        let added = false;

        for (const group of groupedDeps) {
            const foundWithName = group.find(g => g.name === dep.name);
            if (foundWithName) {
                if (foundWithName.version === dep.version) {
                    // If the version is the same, skip adding
                    added = true;
                    break;
                }
                continue;
            }

            group.push(dep);
            added = true;
            break;
        }

        // If the dependency is not in any group, create a new group
        if (!added) {
            groupedDeps.push([dep]);
        }
    }

    return groupedDeps;
}

if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest;

    it("should correctly group dependencies with group function", () => {
        const deps = [
            { name: "dep1", version: "1.0.0" },
            { name: "dep2", version: "1.0.0" },
            { name: "dep1", version: "2.0.0" },
            { name: "dep3", version: "1.0.0" },
            { name: "dep2", version: "2.0.0" },
            { name: "dep3", version: "1.0.0" },
            { name: "dep3", version: "2.0.0" },
            { name: "dep4", version: "1.0.0" },
        ];
        const grouped = group(deps);
        expect(grouped).toEqual([
            [
                { name: "dep1", version: "1.0.0" },
                { name: "dep2", version: "1.0.0" },
                { name: "dep3", version: "1.0.0" },
                { name: "dep4", version: "1.0.0" },
            ],
            [
                { name: "dep1", version: "2.0.0" },
                { name: "dep2", version: "2.0.0" },
                { name: "dep3", version: "2.0.0" },
            ],
        ]);
    });
}
