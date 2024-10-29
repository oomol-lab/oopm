export interface DepRaw {
    name: string;
    version?: string;
}

export interface Dep {
    name: string;
    version: string;
}

export type Deps = Dep[];
