import type { OOPackageSchema } from "../types";
import { execa } from "execa";
import { ERR_OOPM_DEPEND_ITSELF } from "../const";
import { remove } from "../utils/fs";
import { env } from "../utils/misc";
import { createNpmrc, generatePackageJson } from "../utils/npm";
import { defaultIgnore, prePack } from "./pack";

export async function publish(p: string, registry: string, token: string): Promise<OOPackageSchema> {
    const data = await generatePackageJson(p, false);

    for (const dep in data.dependencies) {
        if (dep === data.name) {
            throw ERR_OOPM_DEPEND_ITSELF;
        }
    }

    const workdir = await prePack(p, defaultIgnore);

    await createNpmrc(workdir, registry, token);

    await execa({
        cwd: workdir,
        env: env(registry),
    })`npm publish`;

    await remove(workdir).catch(() => {});

    return data;
}
