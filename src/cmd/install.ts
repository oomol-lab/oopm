import type { Dep, DepRaw, Deps, InstallFileResult } from "../types";
import path from "node:path";
import { execa } from "execa";
import { ooPackageName } from "../const";
import { copyDir, exists, mkdir, move, remove, tempDir, xTar } from "../utils/fs";
import { env } from "../utils/misc";
import {
    findLatestVersion,
    generatePackageJson,
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
}

export interface InstallFileOptions extends InstallBasicOptions {
    file: string;
}

export interface InstallPackageOptions extends InstallBasicOptions {
    workdir: string;
    deps: DepRaw[];
    token?: string;
    save: boolean;
}

export type InstallOptions = InstallAllOptions | InstallFileOptions | InstallPackageOptions;

export async function install(options: InstallAllOptions | InstallPackageOptions): Promise<void>;
export async function install(options: InstallFileOptions): Promise<InstallFileResult>;
export async function install(options: InstallOptions): Promise<InstallFileResult | void> {
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
        await remove(targetDir);
        await mkdir(path.dirname(targetDir));
        await move(tempDir, targetDir);
        return {
            target: targetDir,
            meta,
        };
    }

    const meta = await generatePackageJson(options.file, false);
    const targetDir = path.join(options.distDir, `${meta.name}-${meta.version}`);
    await remove(targetDir);
    await mkdir(path.dirname(targetDir));
    await copyDir(options.file, targetDir);
    return {
        target: targetDir,
        meta,
    };
}

// oopm install foo
// oopm install foo@1.0.0
export async function installPackage(options: InstallPackageOptions) {
    const libraryMeta = await generatePackageJson(options.workdir, false);

    const alreadyInstalled: Deps = [];
    const needInstall: Deps = [];

    // Searching for dependencies that need to be installed and those that have already been installed.
    {
        const p = options.deps.map(async (dep) => {
            let version = dep.version;

            if (!version) {
                version = await findLatestVersion(dep.name, options.token);
            }

            const existsDisk = await exists(path.join(options.distDir, `${dep.name}-${version}`, ooPackageName));
            if (existsDisk && libraryMeta?.dependencies?.[dep.name] === version) {
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

        Object.keys(libraryMeta?.dependencies || {}).forEach((key) => {
            p.push((async (key) => {
                const dep: Dep = {
                    name: key,
                    version: libraryMeta.dependencies![key],
                };

                const existsDisk = await exists(path.join(options.distDir, `${dep.name}-${dep.version}`, ooPackageName));
                if (!existsDisk) {
                    needInstall.push(dep);
                }
            })(key));
        });

        await Promise.all(p);
    }

    await _install({
        alreadyInstalled,
        needInstall,
        save: options.save,
        workdir: options.workdir,
        distDir: options.distDir,
        token: options.token,
    });
}

// oopm install
export async function installAll(options: InstallAllOptions) {
    const libraryMeta = await generatePackageJson(options.workdir, false);

    const alreadyInstalled: Deps = [];
    const needInstall: Deps = [];

    {
        const p = Object.keys(libraryMeta?.dependencies || {}).map(async (key) => {
            const dep: Dep = {
                name: key,
                version: libraryMeta.dependencies![key],
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

    await _install({
        alreadyInstalled,
        needInstall,
        save: false,
        workdir: options.workdir,
        distDir: options.distDir,
        token: options.token,
    });
}

interface _InstallOptions {
    save: boolean;
    token?: string;
    workdir: string;
    distDir: string;
    alreadyInstalled: Deps;
    needInstall: Deps;
}

async function _install(options: _InstallOptions) {
    const temp = await tempDir();
    await initPackageJson(temp, options.needInstall, options.token);

    const cmd = execa({
        all: true,
        cwd: temp,
        env: env(),
    })`npm install`;

    for await (const line of cmd) {
        // eslint-disable-next-line no-console
        console.log(line);
    }

    const info = await transformNodeModules(temp);

    await mkdir(options.distDir);

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
            if (!await exists(target)) {
                return copyDir(i.source, target);
            }
        });

    if (options.save) {
        await updateDependencies(options.workdir, options.needInstall);
    }

    await Promise.all(ps);

    await remove(temp);
}
