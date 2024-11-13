import type { OOPackageSchema } from "../types";
import { execa } from "execa";
import { remove } from "../utils/fs";
import { env } from "../utils/misc";
import { createNpmrc, generatePackageJson } from "../utils/npm";
import { defaultIgnore, prePack } from "./pack";

export async function publish(p: string, registry: string, token: string): Promise<OOPackageSchema> {
    const data = await generatePackageJson(p, false);
    const workdir = await prePack(p, defaultIgnore);

    await createNpmrc(workdir, registry, token);

    const cmd = execa({
        all: true,
        cwd: workdir,
        env: env(registry),
    })`npm publish`;

    for await (const line of cmd) {
        // eslint-disable-next-line no-console
        console.log(line);
    }

    await remove(workdir).catch(() => {});

    return data;
}
