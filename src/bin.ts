import path from "node:path";
import process from "node:process";
import { program } from "commander";
import { version } from "../package.json";
import { install } from "./cmd/install";
import { list } from "./cmd/list";
import { pack } from "./cmd/pack";
import { publish } from "./cmd/publish";
import { thumbnail } from "./cmd/thumbnail";

program
    .name("oopm")
    .description("OOMOL Package Manager")
    .version(version);

program.command("pack")
    .description("Pack a package")
    .argument("[dir]", "The package directory", ".")
    .action(async (dir) => {
        await pack(path.resolve(dir), process.cwd());
    });

program.command("publish")
    .description("Publish a package")
    .argument("[dir]", "The package directory", ".")
    .option("-r --registry <registry>", "The registry", "https://registry.oomol.com")
    .requiredOption("-t --token <token>", "The token")
    .action(async (dir, options) => {
        await publish(path.resolve(dir), options.registry, options.token);
    });

const STORE_DIR = "OOPM_STORE_DIR";
const STORE_DIR_DESC = `The store directory, default is ${STORE_DIR} environment variable or <cwd>${path.sep}.oomol${path.sep}oopm-store`;
const getStoreDir = (dir: string | undefined): string => {
    return dir || process.env[STORE_DIR] || path.join(process.cwd(), ".oomol", "oopm-store");
};

program.command("install")
    .description("Install a package")
    .argument("[pkg...]", "The name of the pkg to be installed or the local address.", "")
    .option("-r --registry <registry>", "The registry", "https://registry.oomol.com")
    .option("-t --token <token>", "The token")
    .option("-d --dist-dir <distDir>", STORE_DIR_DESC)
    .option("-s --search-dir <searchDir...>", undefined, [])
    .action(async (pkgs, options): Promise<any> => {
        const distDir = getStoreDir(options.distDir);

        if (pkgs.length === 0) {
            return await install({
                all: true,
                workdir: process.cwd(),
                distDir,
                registry: options.registry,
                token: options.token,
                searchDirs: options.searchDir,
            });
        }

        if (pkgs.length === 1 && pkgs[0].startsWith(".")) {
            return await install({
                file: pkgs[0],
                distDir,
            });
        }

        return await install({
            deps: pkgs.map((p: string) => {
                const index = p.lastIndexOf("@");
                if (index === -1) {
                    return {
                        name: p,
                    };
                }

                return {
                    name: p.slice(0, index),
                    version: p.slice(index + 1),
                };
            }),
            save: true,
            workdir: process.cwd(),
            distDir,
            registry: options.registry,
            token: options.token,
            searchDirs: options.searchDir,
        });
    });

program.command("list")
    .description("List all packages")
    .argument("[dir]", "The workdir directory", ".")
    .option("-s --search-dir <searchDir...>", STORE_DIR_DESC, [])
    .action(async (dir, options) => {
        const result = await list(path.resolve(dir), options.searchDir);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
    });

program.command("thumbnail")
    .description("Generate thumbnail for a local package")
    .argument("[dir]", "The workdir directory", ".")
    .option("-s --search-dir <searchDir...>", STORE_DIR_DESC)
    .action(async (dir, options) => {
        const thumbnailPaths = await thumbnail(path.resolve(dir), options.searchDir);
        if (thumbnailPaths.length) {
            // eslint-disable-next-line no-console
            console.log("Thumbnail generated successfully.");
        }
        else {
            console.error("Failed to generate thumbnail.");
        }
    });

program.parse();
