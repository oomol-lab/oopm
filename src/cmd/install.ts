import type { Dep, DepRaw, Deps, InstallAllResult, InstallFileResult, InstallPackageResult } from "../types";
import path from "node:path";
import { execa } from "execa";
import { ooPackageName } from "../const";
import { copyDir, exists, mkdir, move, remove, tempDir, xTar } from "../utils/fs";
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
    workdir: string;
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
    await copyDir(options.file, targetDir);
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

    const deps = await _install({
        alreadyInstalled,
        needInstall,
        save: options.save,
        workdir: options.workdir,
        distDir: options.distDir,
        token: options.token,
        registry: options.registry,
    });

    return {
        deps,
    };
}

// oopm install
export async function installAll(options: InstallAllOptions): Promise<InstallAllResult> {
    const dependencies = await getDependencies(options.workdir);

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
    });

    return {
        deps,
    };
}

interface _InstallOptions {
    save: boolean;
    token?: string;
    workdir: string;
    distDir: string;
    alreadyInstalled: Deps;
    needInstall: Deps;
    registry: string;
}

async function _install(options: _InstallOptions): Promise<InstallPackageResult["deps"]> {
    const temp = await tempDir();
    await initPackageJson(temp, options.needInstall, options.registry, options.token);

    const cmd = execa({
        all: true,
        cwd: temp,
        env: env(options.registry),
    })`npm install`;

    for await (const line of cmd) {
        // eslint-disable-next-line no-console
        console.log(line);
    }

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
                return copyDir(i.source, target);
            }
        });

    if (options.save) {
        await updateDependencies(options.workdir, options.needInstall);
    }

    await Promise.all(ps);

    await remove(temp);

    return targets;
}
