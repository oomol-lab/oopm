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

program.command("install")
    .description("Install a package")
    .argument("[pkg...]", "The name of the pkg to be installed or the local address.", "")
    .option("-r --registry <registry>", "The registry", "https://registry.oomol.com")
    .option("-t --token <token>", "The token")
    .option("-d --dist-dir <distDir>", "The dist directory", `.oomol${path.sep}oopm-store`)
    .action(async (pkgs, options): Promise<any> => {
        if (pkgs.length === 0) {
            return await install({
                all: true,
                workdir: process.cwd(),
                distDir: options.distDir,
                registry: options.registry,
                token: options.token,
            });
        }

        if (pkgs.length === 1 && pkgs[0].startsWith(".")) {
            return await install({
                file: pkgs[0],
                distDir: options.distDir,
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
            distDir: options.distDir,
            registry: options.registry,
            token: options.token,
        });
    });

program.command("list")
    .description("List all packages")
    .argument("[dir]", "The workdir directory", ".")
    .requiredOption("-s --search-dir <searchDir>", "The search directory")
    .action(async (dir, options) => {
        const result = await list(path.resolve(dir), options.searchDir);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
    });

program.command("thumbnail")
    .description("Generate thumbnail for a local package")
    .argument("[dir]", "The workdir directory", ".")
    .requiredOption("-s --search-dir <searchDir>", "The search directory")
    .action(async (dir, options) => {
        const thumbnailPath = await thumbnail(path.resolve(dir), options.searchDir);
        if (thumbnailPath) {
            // eslint-disable-next-line no-console
            console.log("Thumbnail generated successfully.");
        }
        else {
            console.error("Failed to generate thumbnail.");
        }
    });

program.parse();
