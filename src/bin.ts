import process from "node:process";
import { program } from "commander";
import { version } from "../package.json";
import { install } from "./cmd/install";
import { pack } from "./cmd/pack";
import { publish } from "./cmd/publish";

program
    .name("oopm")
    .description("OOMOL Package Manager")
    .version(version);

program.command("pack")
    .description("Pack a package")
    .argument("[dir]", "The package directory", ".")
    .action(async (dir) => {
        await pack(dir, process.cwd());
    });

program.command("publish")
    .description("Publish a package")
    .argument("[dir]", "The package directory", ".")
    .action(async (dir) => {
        await publish(dir);
    });

program.command("install")
    .description("Install a package")
    .argument("[pkg...]", "The name of the pkg to be installed or the local address.", "")
    .requiredOption("-d --dist-dir <distDir>", "The dist directory")
    .action(async (pkgs, options) => {
        if (pkgs.length === 0) {
            return await install({
                all: true,
                workdir: process.cwd(),
                distDir: options.distDir,
            });
        }

        if (pkgs.length === 1 && pkgs[0].startsWith(".")) {
            return await install({
                file: pkgs[0],
                workdir: process.cwd(),
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
        });
    });

program.parse();
