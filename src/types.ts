export interface DepRaw {
    name: string;
    version?: string;
}

export interface Dep {
    name: string;
    version: string;
}

export type Deps = Dep[];

export interface InstallFileResult {
    target: string;
    meta: Omit<OOPackageSchema, "scripts">;
    isOverwrite: boolean;
};

export interface OOPackageSchema {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    author?: string;
    dependencies?: Record<string, string>;
    scripts: Record<string, string>;
}
