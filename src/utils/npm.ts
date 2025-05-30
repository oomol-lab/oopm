import type { Deps, OOPackageSchema } from "../types";
import path from "node:path";
import { globby } from "globby";
import YAML from "yaml";
import { ooPackageName } from "../const";
import { exists, readFile, writeFile } from "./fs";
import { nerfURL } from "./misc";

export async function getDependencies(dir?: string): Promise<Record<string, string>> {
    if (dir === undefined) {
        return {};
    }
    const ooPackagePath = path.join(dir, ooPackageName);
    if (!await exists(path.join(dir, ooPackageName))) {
        return {};
    }

    const content = YAML.parse(await readFile(ooPackagePath)) as OOPackageSchema;
    return content.dependencies ?? {};
}

export async function generatePackageJson(dir: string): Promise<string> {
    const ooPackagePath = path.join(dir, ooPackageName);

    if (!await exists(ooPackagePath)) {
        throw new Error(`Not found: ${ooPackagePath}`);
    }

    const content = YAML.parse(await readFile(ooPackagePath)) as OOPackageSchema;

    if (!content?.name) {
        throw new Error(`Missing required field: name in ${ooPackagePath}`);
    }

    if (!content?.version) {
        throw new Error(`Missing required field: version in ${ooPackagePath}`);
    }

    if (content.icon?.startsWith("./")) {
        content.icon = `./${path.join("package", content.icon)}`;
    }

    content.scripts = {};

    content.files = [
        "package",
        "package/.gitignore",
        "package/.oo-thumbnail.json",
    ];

    return JSON.stringify(content, null, 2);
}

export async function getOOPackageBasicInfo(dir: string): Promise<{
    name: string;
    version: string;
    dependencies: Record<string, string>;
}> {
    const ooPackagePath = path.join(dir, ooPackageName);
    const content = YAML.parse(await readFile(ooPackagePath)) as OOPackageSchema;

    if (!content?.name) {
        throw new Error(`Missing required field: name in ${ooPackagePath}`);
    }

    if (!content?.version) {
        throw new Error(`Missing required field: version in ${ooPackagePath}`);
    }

    return {
        name: content.name,
        version: content.version,
        dependencies: content.dependencies ?? {},
    };
}

export async function checkOOPackage(dir: string): Promise<boolean> {
    const ooPackagePath = path.join(dir, ooPackageName);
    if (!(await exists(ooPackagePath))) {
        return false;
    }
    try {
        const content = YAML.parse(await readFile(ooPackagePath)) as OOPackageSchema;
        return !!(content.name && content.version);
    }
    catch (_error) {
        return false;
    }
}

export async function updateDependencies(dir: string, deps: Deps) {
    const ooPackagePath = path.join(dir, ooPackageName);
    if (!(await exists(ooPackagePath))) {
        await writeFile(ooPackagePath, "");
    }

    const rawContent = await readFile(path.join(dir, ooPackageName));
    const content = YAML.parse(rawContent) as OOPackageSchema || {};

    if (!content.name) {
        content.name = path.basename(dir);
    }

    if (!content.version) {
        content.version = "0.0.1";
    }

    if (!content.dependencies) {
        content.dependencies = {};
    }

    for (const dep of deps) {
        content.dependencies[dep.name] = dep.version;
    }

    const yamlContent = YAML.stringify(content);
    await writeFile(path.join(dir, ooPackageName), yamlContent);
}

export async function findLatestVersion(name: string, registry: string, token?: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(`${registry}/${name}`, {
        headers,
    });

    if (!resp.ok) {
        throw new Error(`Failed to fetch package: ${name}`);
    }

    const data = await resp.json() as any;

    return data["dist-tags"].latest;
}

export async function initPackageJson(dir: string, deps: Deps, registry: string, token?: string) {
    const packageJsonPath = path.join(dir, "package.json");

    await writeFile(packageJsonPath, JSON.stringify({
        name: "oopm-package-temp",
        version: "0.0.1",
        scripts: {
        },
        dependencies: deps.reduce((acc, dep) => {
            acc[dep.name] = dep.version;
            return acc;
        }, {} as Record<string, string>),
    }, null, 2));

    if (token) {
        await createNpmrc(dir, registry, token);
    }
}

export async function createNpmrc(dir: string, registry: string, token: string) {
    const npmrcPath = path.join(dir, ".npmrc");

    await writeFile(npmrcPath, `${nerfURL(registry)}:_authToken=${token}`);
}

export async function transformNodeModules(dir: string) {
    const result = await globby("node_modules/**/package/package.oo.yaml", {
        onlyFiles: true,
        cwd: dir,
        dot: false,
        absolute: true,
    });

    const map = new Map<string, {
        source: string;
        name: string;
        version: string;
    }>();

    const ps = result
        // Filter out paths that do not conform to this rule: node_modules/PACKAGE_NAME/package/package.oo.yaml
        .filter((p) => {
            // [..., "node_modules", PACKAGE_NAME, "package", "package.oo.yaml"]
            const parts = p.split(path.sep);
            return parts[parts.length - 4] === "node_modules";
        })
        .map(async (p) => {
            const source = path.dirname(p);
            const { name, version } = await getOOPackageBasicInfo(source);

            map.set(`${name}-${version}`, {
                source,
                name,
                version,
            });
        });

    await Promise.all(ps);

    return Array.from(map.values());
}
