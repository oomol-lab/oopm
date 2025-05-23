import path from "node:path";
import { execa } from "execa";
import { globby } from "globby";
import { copyDir, remove, tempDir, writeFile } from "../utils/fs";
import { env } from "../utils/misc";
import { generatePackageJson } from "../utils/npm";

export const defaultIgnore = [
    "node_modules",
    ".git",
    ".DS_Store",
    "__pycache__",
];

export async function prePack(p: string, ignore: string[]) {
    const packageJson = await generatePackageJson(p);

    const workdir = await tempDir();

    const files = await globby(["**", "!.oomol"], {
        cwd: p,
        dot: true,
        onlyFiles: false,
        gitignore: true,
        ignore,
        absolute: true,
    });

    const alwaysAllow = [path.join(p, ".oo-thumbnail.json")];

    await Promise.all([
        copyDir(p, path.join(workdir, "package"), (src, _dest, source, _destination) => {
            if (source === src) {
                return true;
            }

            if (alwaysAllow.includes(source)) {
                return true;
            }

            return files.includes(source);
        }),
        writeFile(path.join(workdir, "package.json"), packageJson),
    ]);

    return workdir;
}

export async function pack(p: string, outDir: string, ignore: string[] = defaultIgnore) {
    const workdir = await prePack(p, ignore);

    await execa({
        cwd: workdir,
        env: env(""),
    })`npm pack --pack-destination ${outDir}`;

    await remove(workdir).catch(() => {});
}
