import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export interface PackageThumbnail {
    title?: string;
    description?: string;
    icon?: string;
    flows?: FlowThumbnail[];
    blocks?: BlockThumbnail[];
}

interface FlowThumbnail {
    name: string;
    title?: string;
    description?: string;
    icon?: string;
    nodes?: NodeThumbnail[];
    uiData?: any;
}

interface BlockThumbnail {
    name: string;
    title?: string;
    description?: string;
    icon?: string;
    inputHandleDefs?: InputHandleDef[];
    outputHandleDefs?: OutputHandleDef[];
    executorName?: string;
    nodes?: Node[];
    handleOutputsFrom?: HandleOutputFrom[];
}

interface NodeThumbnail {
    nodeId: string;
    type?: string;
    title?: string;
    description?: string;
    icon?: string;
    task?: string;
    subflow?: string;
    executorName?: string;
    valueHandleDefs?: ValueHandleDef[];
    inputHandleDefs?: InputHandleDef[];
    additionalInputs?: boolean;
    additionalInputDefs?: InputHandleDef[];
    outputHandleDefs?: OutputHandleDef[];
    additionalOutputs?: boolean;
    additionalOutputDefs?: OutputHandleDef[];
    slots?: SlotProvider[];
    slotNodeDefs?: SlotNodeDef[];
    handleInputsFrom?: HandleInputFrom[];
}

interface SlotNodeDef {
    slot_node_id: string;
    title?: string;
    icon?: string;
    description?: string;
    inputHandleDefs?: InputHandleDef[];
}

interface SlotProvider {
    slot_node_id: string;
    slotflow?: string;
    subflow?: string;
    task?: string;
    inputs_def?: InputHandleDef[];
    inputs_from?: HandleInputFrom[];
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
    from_subflow?: HandleFromSubflow[] | undefined;
    from_node?: HandleFromNode[] | undefined;
    from_slot?: HandleFromSlot[] | undefined;
}

interface HandleOutputFrom {
    handle: string;
    from_subflow?: HandleFromSubflow[] | undefined;
    from_node?: HandleFromNode[] | undefined;
    from_slot?: HandleFromSlot[] | undefined;
}

interface HandleFromSubflow {
    input_handle: string;
}

interface HandleFromNode {
    node_id: string;
    output_handle: string;
}

interface HandleFromSlot {
    subflow_node_id: string;
    slot_node_id: string;
    input_handle: string;
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
    additional_outputs?: boolean;
}

interface SubflowOOYaml {
    inputs_def?: InputHandleDef[];
    outputs_def?: OutputHandleDef[];
    render?: string;
    ui?: any;
    title?: string;
    description?: string;
    icon?: string;
    nodes: Node[];
    outputs_from?: HandleOutputFrom[];
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
    ignore?: boolean;
    title?: string;
    icon?: string;
    description?: string;
    values?: ValueHandleDef[];
    timeout?: number;
    inputs_from?: HandleInputFrom[];
    concurrency?: number;

    task?: string | InlineTaskBlock;
    /** additional input defs, only when 'task' is string */
    inputs_def?: InputHandleDef[];
    /** additional output defs, only when 'task' is string */
    outputs_def?: InputHandleDef[];

    subflow?: string;
    slots?: SlotProvider[];

    slot?: InlineSlotBlock;
}

interface InlineSlotBlock {
    inputs_def?: InputHandleDef[] | undefined;
    outputs_def?: OutputHandleDef[] | undefined;
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
interface SubflowEntry { package: string; id: string; path: string; yaml: SubflowOOYaml }

interface WorkspaceProvider {
    provideWorkspace: () => ProviderResult<PackageOOYaml>;
    provideFlows: () => ProviderResult<FlowEntry[]>;
    provideTask: (identifier: string) => ProviderResult<TaskEntry>;
    provideSubflow: (identifier: string) => ProviderResult<SubflowEntry>;
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
const subflowOOYaml = "subflow.oo.yaml";
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

const isFile = async (path: string): Promise<boolean> => {
    try {
        return (await fs.stat(path)).isFile();
    }
    catch {
        return false;
    }
};

const readFile = async (path: string): Promise<string | undefined> => {
    try {
        return await fs.readFile(path, "utf8");
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
        const items = await fs.readdir(flowsDir);
        await Promise.allSettled(items.map((name) => {
            const file = path.join(flowsDir, name, flowOOYaml);
            return this._readFlow(name, file, result);
        }));
        return result;
    }

    private async _readFlow(id: string, flowPath: string, result: FlowEntry[]) {
        if (!await isFile(flowPath)) {
            return;
        }
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
        let file: string | undefined;
        if (dep === "self" && task) {
            file = path.join(this.workspaceDir, "tasks", task, taskOOYaml);
        }
        else {
            const version = pkg.dependencies?.[dep];
            if (dep && task && version) {
                const pkgDir = path.join(this.storeDir, `${dep}-${version}`);
                file = path.join(pkgDir, "tasks", task, taskOOYaml);
            }
        }
        if (file && await isFile(file)) {
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

    async provideSubflow(identifier: string): Promise<SubflowEntry | undefined> {
        const pkg = await this.provideWorkspace();
        const [dep, subflow] = identifier.split("::");
        let file: string | undefined;
        if (dep === "self" && subflow) {
            file = path.join(this.workspaceDir, "subflows", subflow, subflowOOYaml);
        }
        else {
            const version = pkg.dependencies?.[dep];
            if (dep && subflow && version) {
                const pkgDir = path.join(this.storeDir, `${dep}-${version}`);
                file = path.join(pkgDir, "subflows", subflow, subflowOOYaml);
            }
        }
        if (file && await isFile(file)) {
            try {
                return {
                    package: dep,
                    id: subflow,
                    path: file,
                    yaml: YAML.parse((await readFile(file))!),
                };
            }
            catch { }
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
        const rawTasks = await this._listTasks();
        for (const name of rawTasks) {
            const task = await this.provideTask(`self::${name}`);
            if (task) {
                result.blocks!.push({
                    name: task.id,
                    title: task.yaml.title,
                    description: task.yaml.description,
                    icon: task.yaml.icon,
                    inputHandleDefs: task.yaml.inputs_def,
                    outputHandleDefs: task.yaml.outputs_def,
                    executorName: task.yaml.executor.name,
                });
            }
        }
        const rawSubflows = await this._listSubflows();
        for (const name of rawSubflows) {
            const subflow = await this.provideSubflow(`self::${name}`);
            if (subflow) {
                result.blocks!.push({
                    name: subflow.id,
                    title: subflow.yaml.title,
                    description: subflow.yaml.description,
                    icon: subflow.yaml.icon,
                    inputHandleDefs: subflow.yaml.inputs_def,
                    outputHandleDefs: subflow.yaml.outputs_def,
                    nodes: subflow.yaml.nodes,
                    handleOutputsFrom: subflow.yaml.outputs_from,
                });
            }
        }
        return result;
    }

    private async _listTasks(): Promise<string[]> {
        try {
            return await fs.readdir(path.join(this.workspaceDir, "tasks"));
        }
        catch {
            return [];
        }
    }

    private async _listSubflows(): Promise<string[]> {
        try {
            return await fs.readdir(path.join(this.workspaceDir, "subflows"));
        }
        catch {
            return [];
        }
    }

    private async _getFlowThumbnail(raw: FlowEntry): Promise<FlowThumbnail | undefined> {
        const nodes: NodeThumbnail[] = [];
        for (const nodeManifest of raw.yaml.nodes) {
            const node = await this._getNodeThumbnail(nodeManifest, raw.path);
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

    private async _getNodeThumbnail(raw: Node, manifestPath: string): Promise<NodeThumbnail | undefined> {
        const node: NodeThumbnail = {
            nodeId: raw.node_id,
            title: raw.title,
            icon: await this._resolveUrl(raw.icon, manifestPath),
            description: raw.description,
        };

        if (raw.values) {
            node.type = NODE_TYPE.ValueNode;
            node.valueHandleDefs = raw.values;
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
                node.additionalOutputs = task.yaml.additional_outputs;
            }
            else {
                // Guess input handle defs from inputs from.
                node.inputHandleDefs = raw.inputs_from?.map(a => ({
                    handle: a.handle,
                    json_schema: this._schemaFromValue(a.value),
                }));
            }
            node.additionalInputDefs = raw.inputs_def;
            node.additionalOutputDefs = raw.outputs_def;
            node.handleInputsFrom = raw.inputs_from;
        }
        else if (raw.task) {
            node.type = NODE_TYPE.TaskNode;
            node.icon = executorIcon(raw.task.executor);
            node.executorName = raw.task.executor.name;
            node.inputHandleDefs = raw.task.inputs_def;
            node.outputHandleDefs = raw.task.outputs_def;
            node.handleInputsFrom = raw.inputs_from;
        }
        else if (typeof raw.subflow === "string") {
            node.type = NODE_TYPE.SubflowNode;
            node.subflow = raw.subflow;
            const subflow = await this.provideSubflow(raw.subflow);
            if (subflow) {
                node.icon = await this._resolveUrl(subflow.yaml.icon, subflow.path);
                node.inputHandleDefs = subflow.yaml.inputs_def;
                node.outputHandleDefs = subflow.yaml.outputs_def;
                node.slotNodeDefs = await this._getSlotNodeDefs(subflow, raw);
            }
            else {
                // Guess input handle defs from inputs from.
                node.inputHandleDefs = raw.inputs_from?.map(a => ({
                    handle: a.handle,
                    json_schema: this._schemaFromValue(a.value),
                }));
            }
            node.slots = raw.slots;
            node.handleInputsFrom = raw.inputs_from;
        }
        else {
            // Not implemented.
            node.type = NODE_TYPE.ErrorNode;
            // XXX: Guess output handle defs from other nodes' inputs from.
        }

        return node;
    }

    private async _getSlotNodeDefs(subflow: SubflowEntry | undefined, ownerNode: Node): Promise<SlotNodeDef[] | undefined> {
        if (!subflow) {
            return;
        }
        const slotNodeDefs: SlotNodeDef[] = [];
        for (const node of subflow.yaml.nodes) {
            if (node.slot) {
                slotNodeDefs.push({
                    slot_node_id: node.node_id,
                    title: node.title,
                    icon: await this._resolveUrl(node.icon, subflow.path),
                    description: node.description,
                    inputHandleDefs: ownerNode.slots?.find(s => s.slot_node_id === node.node_id)?.inputs_def,
                });
            }
        }
        return slotNodeDefs;
    }

    private _schemaFromValue(value: any): any {
        if (value == null) {
            return {};
        }
        switch (typeof value) {
            case "string":
                return { type: "string" };
            case "number":
                return { type: "number" };
            case "boolean":
                return { type: "boolean" };
            case "object":
                if (Array.isArray(value)) {
                    return { type: "array", items: this._schemaFromValue(value[0]) };
                }
                return { type: "object" };
            default:
                return {};
        }
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
