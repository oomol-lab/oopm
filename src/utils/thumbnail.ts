import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface PackageThumbnail {
    title?: string;
    description?: string;
    icon?: string;
    flows?: FlowThumbnail[];
    blocks?: any[];
}

interface FlowThumbnail {
    name: string;
    title?: string;
    description?: string;
    icon?: string;
    nodes?: NodeThumbnail[];
    uiData?: any;
}

interface NodeThumbnail {
    nodeId: string;
    type?: string;
    title?: string;
    description?: string;
    icon?: string;
    task?: string;
    executorName?: string;
    valueHandleDefs?: ValueHandleDef[];
    inputHandleDefs?: InputHandleDef[];
    additionalInputs?: boolean;
    additionalInputDefs?: InputHandleDef[];
    outputHandleDefs?: OutputHandleDef[];
    handleInputsFrom?: HandleInputFrom[];
}

interface OutputHandleDef {
    handle: string;
    description?: string;
    json_schema?: any;
    kind?: string;
    nullable?: boolean;
}

interface InputHandleDef extends OutputHandleDef {
    value?: any;
}

interface ValueHandleDef extends InputHandleDef { }

interface HandleInputFrom {
    handle: string;
    value?: any;
    from_node?: HandleFromNode[];
}

interface HandleFromNode {
    node_id: string;
    output_handle: string;
}

interface TaskOOYaml {
    inputs_def?: InputHandleDef[];
    outputs_def?: OutputHandleDef[];
    render?: string;
    ui?: any;
    title?: string;
    description?: string;
    icon?: string;
    executor: Executor;
    additional_inputs?: boolean;
}

interface Executor { name: string; options?: { entry?: string } }

const executorIcon = (executor: Executor): string | undefined => {
    if (executor.name === "python") {
        return ":logos:python:";
    }
    if (executor.name === "nodejs") {
        return executor.options?.entry?.endsWith(".ts") ? ":skill-icons:typescript:" : ":skill-icons:javascript:";
    }
};

interface FlowOOYaml {
    title?: string;
    description?: string;
    icon?: string;
    nodes: Node[];
}

interface Node {
    node_id: string;
    flow?: any;
    slot?: any;
    ignore?: boolean;
    title?: string;
    description?: string;
    values?: ValueHandleDef[];
    timeout?: number;
    inputs_from?: HandleInputFrom[];
    concurrency?: number;
    task: string | InlineTaskBlock;
    inputs_def?: InputHandleDef[];
}

interface InlineTaskBlock {
    inputs_def?: InputHandleDef[];
    outputs_def?: OutputHandleDef[];
    render?: string;
    ui?: any;
    executor: Executor;
}

type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

interface FlowEntry { id: string; path: string; yaml: FlowOOYaml; uiData: any }
interface TaskEntry { package: string; id: string; path: string; yaml: TaskOOYaml }

interface WorkspaceProvider {
    provideWorkspace: () => ProviderResult<PackageOOYaml>;
    provideFlows: () => ProviderResult<FlowEntry[]>;
    provideTask: (identifier: string) => ProviderResult<TaskEntry>;
}

interface ThumbnailProvider {
    provideThumbnail: () => ProviderResult<PackageThumbnail>;
}

interface PackageOOYaml {
    name?: string;
    version?: string;
    description?: string;
    icon?: string;
    dependencies?: { [pkg: string]: string };
}

const flowOOYaml = "flow.oo.yaml";
const taskOOYaml = "task.oo.yaml";
const flowUIOOJson = ".flow.ui.oo.json";
const packageOOYaml = "package.oo.yaml";
const assetsBaseUrl = "https://package-assets.oomol.com/packages/";

enum NODE_TYPE {
    ErrorNode = "error_node",
    InputNode = "input_node",
    OutputNode = "output_node",
    TaskNode = "task_node",
    SubflowNode = "subflow_node",
    SlotNode = "slot_node",
    ValueNode = "value_node",
}

const readFile = async (path: string): Promise<string | undefined> => {
    try {
        return await fs.promises.readFile(path, "utf8");
    }
    catch { }
};

const jsonTryParse = (data: string | undefined): any => {
    if (!data) {
        return;
    }
    try {
        return JSON.parse(data);
    }
    catch { }
};

export class Thumbnail implements WorkspaceProvider, ThumbnailProvider {
    constructor(
        private readonly workspaceDir: string,
        private readonly storeDir: string,
    ) { }

    async provideFlows(): Promise<FlowEntry[] | undefined> {
        const result: FlowEntry[] = [];
        const flowsDir = path.join(this.workspaceDir, "flows");
        const items = fs.readdirSync(flowsDir);
        const tasks: Promise<unknown>[] = [];
        for (const name of items) {
            const file = path.join(flowsDir, name, flowOOYaml);
            if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                tasks.push(this._readFlow(name, file, result));
            }
        }
        await Promise.allSettled(tasks);
        return result;
    }

    private async _readFlow(id: string, flowPath: string, result: FlowEntry[]) {
        const yamlContent = readFile(flowPath);
        const jsonContent = readFile(flowPath.replace(flowOOYaml, flowUIOOJson));
        const entry: FlowEntry = {
            id,
            path: flowPath,
            yaml: YAML.parse((await yamlContent)!),
            uiData: jsonTryParse(await jsonContent),
        };
        result.push(entry);
    }

    async provideWorkspace(): Promise<PackageOOYaml> {
        const yamlContent = await readFile(path.join(this.workspaceDir, packageOOYaml));
        return YAML.parse(yamlContent!);
    }

    async provideTask(identifier: string): Promise<TaskEntry | undefined> {
        const pkg = await this.provideWorkspace();
        const [dep, task] = identifier.split("::");
        const version = pkg.dependencies?.[dep];
        if (dep && task && version) {
            const pkgDir = path.join(this.storeDir, `${dep}-${version}`);
            const file = path.join(pkgDir, "tasks", task, taskOOYaml);
            if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                try {
                    return {
                        package: dep,
                        id: task,
                        path: file,
                        yaml: YAML.parse((await readFile(file))!),
                    };
                }
                catch { }
            }
        }
    }

    async provideThumbnail(): Promise<PackageThumbnail | undefined> {
        const pkg = await this.provideWorkspace();
        const result: PackageThumbnail = {
            title: pkg.name,
            icon: await this._resolveUrl(pkg.icon, path.join(this.workspaceDir, packageOOYaml)),
            description: pkg.description,
            flows: [],
            blocks: [],
        };
        const rawFlows = (await this.provideFlows()) || [];
        for (const rawFlow of rawFlows) {
            const flow = await this._getFlowThumbnail(rawFlow);
            if (flow) {
                result.flows!.push(flow);
            }
        }
        return result;
    }

    private async _getFlowThumbnail(raw: FlowEntry): Promise<FlowThumbnail | undefined> {
        const nodes: NodeThumbnail[] = [];
        for (const nodeManifest of raw.yaml.nodes) {
            const node = await this._getNodeThumbnail(nodeManifest);
            if (node) {
                nodes.push(node);
            }
        }
        return {
            name: raw.id,
            title: raw.yaml.title,
            description: raw.yaml.description,
            icon: await this._resolveUrl(raw.yaml.icon, raw.path),
            nodes,
            uiData: raw.uiData,
        };
    }

    private async _getNodeThumbnail(raw: Node): Promise<NodeThumbnail | undefined> {
        const node: NodeThumbnail = {
            nodeId: raw.node_id,
            title: raw.title,
            description: raw.description,
        };

        if (raw.values) {
            node.type = NODE_TYPE.ValueNode;
            node.valueHandleDefs = raw.values;
        }
        else if (raw.flow || raw.slot) {
            // Not implemented.
            node.type = NODE_TYPE.ErrorNode;
        }
        else if (typeof raw.task === "string") {
            node.type = NODE_TYPE.TaskNode;
            node.task = raw.task;
            const task = await this.provideTask(raw.task);
            if (task) {
                node.icon = await this._resolveUrl(task.yaml.icon, task.path);
                node.executorName = task.yaml.executor.name;
                node.inputHandleDefs = task.yaml.inputs_def;
                node.additionalInputs = task.yaml.additional_inputs;
                node.outputHandleDefs = task.yaml.outputs_def;
            }
            node.additionalInputDefs = raw.inputs_def;
            node.handleInputsFrom = raw.inputs_from;
        }
        else if (raw.task) {
            node.type = NODE_TYPE.TaskNode;
            node.icon = executorIcon(raw.task.executor);
            node.executorName = raw.task.executor.name;
            node.inputHandleDefs = raw.inputs_def;
            node.outputHandleDefs = raw.task.outputs_def;
            node.handleInputsFrom = raw.inputs_from;
        }
        else {
            // Not implemented.
            node.type = NODE_TYPE.ErrorNode;
        }

        return node;
    }

    private async _resolveUrl(p: string | undefined, manifestPath: string): Promise<string | undefined> {
        if (!p) {
            return;
        }

        if (p.startsWith(":") && p.endsWith(":")) {
            return p;
        }

        if (p.startsWith("https://") || p.startsWith("http://") || p.startsWith("data:")) {
            return p;
        }

        if (!p.startsWith("/")) {
            const baseDir = path.dirname(manifestPath);
            p = path.join(baseDir, p);
        }

        if (p.startsWith(this.storeDir)) {
            p = path.relative(this.storeDir, p); // p = 'oomol-file-0.0.4/icon.png'
        }
        else {
            p = path.relative(this.workspaceDir, p); // p = 'icon.png'
            const pkg = await this.provideWorkspace();
            if (pkg.name && pkg.version) {
                p = `${pkg.name}-${pkg.version}/${p}`;
            }
            else {
                return;
            }
        }
        p = p.replace(/\\+/g, "/");
        if (p.startsWith("..")) {
            // reject any path outside of its package.
            return;
        }

        const [pkg, version, file] = this._splitPath(p);
        if (!file) {
            return;
        }

        return `${assetsBaseUrl}${pkg}/${version}/files/package/${file}`;
    }

    private _splitPath(p: string): [string, string, string] {
        let pkgver = p;
        let file = "";
        const i = p.indexOf("/");
        if (i >= 0) {
            pkgver = p.slice(0, i);
            file = p.slice(i + 1);
        }
        const m = pkgver.match(/-\d+\./);
        if (m?.index) {
            const pkg = pkgver.slice(0, m.index);
            const version = pkgver.slice(m.index + 1);
            return [pkg, version, file];
        }
        return [p, "", file];
    }
}
