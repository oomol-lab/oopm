import { execa } from "execa";
import { ERR_OOPM_DEPEND_ITSELF } from "../const";
import { remove } from "../utils/fs";
import { env } from "../utils/misc";
import { createNpmrc, getOOPackageBasicInfo } from "../utils/npm";
import { defaultIgnore, prePack } from "./pack";

export async function publish(p: string, registry: string, token: string, visibility: string): Promise<{
    name: string;
    version: string;
}> {
    const { name, version, dependencies } = await getOOPackageBasicInfo(p);

    if (dependencies[name]) {
        throw ERR_OOPM_DEPEND_ITSELF;
    }

    const workdir = await prePack(p, defaultIgnore);

    await createNpmrc(workdir, registry, token);

    await execa({
        cwd: workdir,
        env: env(registry),
    })`npm publish --access ${visibility === "public" ? "public" : "restricted"}`;

    await remove(workdir).catch(() => {});

    return {
        name,
        version,
    };
}
