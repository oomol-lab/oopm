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
    isOverwrite: boolean;
}

export interface InstallPackageResult {
    deps: Record<`${Dep["name"]}-${Dep["version"]}`, Dep & {
        target: string;
        isAlreadyExist: boolean;
    }>;
    primaryDepNames: Array<`${Dep["name"]}-${Dep["version"]}`>;
}

export interface InstallAllResult extends InstallPackageResult {}

export interface OOPackageSchema {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    author?: string;
    dependencies?: Record<string, string>;
    scripts: Record<string, string>;
    icon?: string;
    files?: string[];
}

export interface SearchDep {
    name: string;
    version: string;
    distDir: string;
}

export type IDepMap = Map<`${string}-${string}`, SearchDep>;
