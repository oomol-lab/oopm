import { execa } from "execa";
import { ERR_OOPM_DEPEND_ITSELF } from "../const";
import { remove } from "../utils/fs";
import { env } from "../utils/misc";
import { createNpmrc, getOOPackageBasicInfo } from "../utils/npm";
import { defaultIgnore, prePack } from "./pack";

export async function publish(p: string, registry: string, token: string, visibility: "public" | "private" = "public", tag?: string): Promise<{
    name: string;
    version: string;
}> {
    const { name, version, dependencies } = await getOOPackageBasicInfo(p);

    if (dependencies[name]) {
        throw ERR_OOPM_DEPEND_ITSELF;
    }

    const workdir = await prePack(p, defaultIgnore);

    await createNpmrc(workdir, registry, token);

    const accessFlag = visibility === "public" ? "public" : "restricted";
    const tagArgs = tag ? ["--tag", tag] : [];

    await execa({
        cwd: workdir,
        env: env(registry),
    })`npm publish --access ${accessFlag} ${tagArgs}`;

    await remove(workdir).catch(() => {});

    return {
        name,
        version,
    };
}
