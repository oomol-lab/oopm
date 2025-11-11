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
    inputHandleDefs?: (InputHandleDef | GroupDividerDef)[];
    outputHandleDefs?: (OutputHandleDef | GroupDividerDef)[];
    executorName?: string;
    nodes?: Node[];
    handleOutputsFrom?: HandleOutputFrom[];
    uiData?: any;
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
    inputHandleDefs?: (InputHandleDef | GroupDividerDef)[];
    additionalInputs?: boolean;
    additionalInputDefs?: InputHandleDef[];
    outputHandleDefs?: (OutputHandleDef | GroupDividerDef)[];
    additionalOutputs?: boolean;
    additionalOutputDefs?: OutputHandleDef[];
    conditionHandleDefs?: ConditionHandleDef[];
    defaultConditionHandleDef?: DefaultConditionHandleDef;
    slots?: SlotProvider[];
    slotNodeDefs?: SlotNodeDef[];
    handleInputsFrom?: HandleInputFrom[];
}

interface SlotNodeDef {
    slot_node_id: string;
    title?: string;
    icon?: string;
    description?: string;
    inputHandleDefs?: (InputHandleDef | GroupDividerDef)[];
}

interface SlotProvider {
    slot_node_id: string;
    slotflow?: string;
    subflow?: string;
    task?: string;
    inputs_def?: InputHandleDef[];
    inputs_from?: HandleInputFrom[];
}

interface GroupDividerDef {
    group: string;
    collapsed?: boolean;
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

interface ConditionExpression {
    input_handle: string;
    operator: string;
    value?: any;
}

interface DefaultConditionHandleDef {
    handle: string;
    description?: string;
}

interface ConditionHandleDef extends DefaultConditionHandleDef {
    logical?: string;
    expressions?: ConditionExpression[];
}

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

interface Executor { name: string; options?: { entry?: string } }

const executorIcon = (executor: Executor): string | undefined => {
    if (executor.name === "python") {
        return ":logos:python:";
    }
    if (executor.name === "nodejs") {
        return executor.options?.entry?.endsWith(".ts") ? ":skill-icons:typescript:" : ":skill-icons:javascript:";
    }
};

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

    conditions?: InlineConditionBlock;
}

interface InlineConditionBlock {
    cases?: ConditionHandleDef[];
    default?: DefaultConditionHandleDef;
}

interface InlineSlotBlock {
    inputs_def?: (InputHandleDef | GroupDividerDef)[] | undefined;
    outputs_def?: (OutputHandleDef | GroupDividerDef)[] | undefined;
}

interface InlineTaskBlock {
    inputs_def?: (InputHandleDef | GroupDividerDef)[];
    outputs_def?: (OutputHandleDef | GroupDividerDef)[];
    render?: string;
    ui?: any;
    executor: Executor;
}

type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

interface ThumbnailProvider {
    provideThumbnail: () => ProviderResult<PackageThumbnail>;
}

const flowUIOOJson = ".flow.ui.oo.json";
const assetsBaseUrl = "https://package-assets.oomol.com/packages/";

enum NODE_TYPE {
    ErrorNode = "error_node",
    InputNode = "input_node",
    OutputNode = "output_node",
    TaskNode = "task_node",
    SubflowNode = "subflow_node",
    SlotNode = "slot_node",
    ValueNode = "value_node",
    ConditionNode = "condition_node",
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

const manifestFileCache = new Map<string, Record<string, any> | null>();

export class Thumbnail implements ThumbnailProvider {
    public static clearCache(): void {
        manifestFileCache.clear();
    }

    public static async create(workspaceDir: string, registryStoreDir: string, lang?: string): Promise<Thumbnail | undefined> {
        const depsQuery = new DepsQuery(registryStoreDir, lang);
        const wsPkgData = await PkgData.createWS(
            depsQuery,
            workspaceDir,
            lang,
        );
        if (wsPkgData) {
            return new Thumbnail(wsPkgData);
        }
    }

    private constructor(
        private readonly wsPkgData: PkgData,
    ) { }

    async provideThumbnail(): Promise<PackageThumbnail | undefined> {
        const result: PackageThumbnail = {
            title: this.wsPkgData.packageName,
            icon: this.wsPkgData.icon,
            description: this.wsPkgData.description,
            flows: await this._provideFlowsThumbnail(),
        };

        const rawTasks = await this._listTasks();
        for (const name of rawTasks) {
            const taskData = await this.wsPkgData.getSharedBlockByName("task", name);
            if (taskData) {
                (result.blocks ??= []).push({
                    name: taskData.blockName,
                    title: taskData.title,
                    description: taskData.description,
                    icon: taskData.icon,
                    inputHandleDefs: taskData.data.inputs_def,
                    outputHandleDefs: taskData.data.outputs_def,
                    executorName: taskData.data.executor?.name,
                });
            }
        }
        const rawSubflows = await this._listSubflows();
        for (const name of rawSubflows) {
            const subflowData = await this.wsPkgData.getSharedBlockByName("subflow", name);
            if (subflowData) {
                (result.blocks ??= []).push({
                    name: subflowData.blockName,
                    title: subflowData.title,
                    description: subflowData.description,
                    icon: subflowData.icon,
                    inputHandleDefs: subflowData.data.inputs_def,
                    outputHandleDefs: subflowData.data.outputs_def,
                    nodes: subflowData.data.nodes,
                    handleOutputsFrom: subflowData.data.outputs_from,
                    uiData: subflowData.uiData,
                });
            }
        }
        return result;
    }

    private async _listTasks(): Promise<string[]> {
        try {
            return await fs.readdir(path.join(this.wsPkgData.packageDir, "tasks"));
        }
        catch {
            return [];
        }
    }

    private async _listSubflows(): Promise<string[]> {
        try {
            return await fs.readdir(path.join(this.wsPkgData.packageDir, "subflows"));
        }
        catch {
            return [];
        }
    }

    private async _provideFlowsThumbnail(): Promise<FlowThumbnail[]> {
        const result: FlowThumbnail[] = [];
        const flowsDir = path.join(this.wsPkgData.packageDir, "flows");
        const flowNames = await fs.readdir(flowsDir);
        for (const flowName of flowNames) {
            const flowData = await FlowLikeData.create(this.wsPkgData, flowName, path.join(flowsDir, flowName), "flow");
            if (flowData) {
                const flowThumbnail = await this._getFlowThumbnail(flowData);
                if (flowThumbnail) {
                    result.push(flowThumbnail);
                }
            }
        }
        return result;
    }

    private async _getFlowThumbnail(flowData: FlowLikeData): Promise<FlowThumbnail | undefined> {
        const nodes: NodeThumbnail[] = [];
        for (const nodeManifest of flowData.data.nodes || []) {
            if (nodeManifest?.node_id) {
                const node = await this._getNodeThumbnail(nodeManifest, flowData);
                if (node) {
                    nodes.push(node);
                }
            }
        }
        return {
            name: flowData.manifestName,
            title: this.wsPkgData.localize(flowData.title),
            description: this.wsPkgData.localize(flowData.description),
            icon: flowData.icon,
            nodes,
            uiData: flowData.uiData,
        };
    }

    private async _getNodeThumbnail(raw: Node, flowData: FlowLikeData): Promise<NodeThumbnail | undefined> {
        const node: NodeThumbnail = {
            nodeId: raw.node_id,
            title: this.wsPkgData.localize(raw.title),
            icon: flowData.pkgData.resolveResourceURI(raw.icon, flowData.manifestDir),
            description: this.wsPkgData.localize(raw.description),
        };

        if (raw.values) {
            node.type = NODE_TYPE.ValueNode;
            node.valueHandleDefs = raw.values;
        }
        else if (typeof raw.task === "string") {
            node.type = NODE_TYPE.TaskNode;
            node.task = raw.task;
            const taskData = await this.wsPkgData.resolveSharedBlock("task", raw.task);
            if (taskData) {
                node.icon ??= taskData.icon;
                node.executorName = taskData.data.executor?.name;
                node.inputHandleDefs = taskData.data.inputs_def;
                node.additionalInputs = taskData.data.additional_inputs;
                node.outputHandleDefs = taskData.data.outputs_def;
                node.additionalOutputs = taskData.data.additional_outputs;
                node.slotNodeDefs = await this._getSlotNodeDefs(taskData, "slot_nodes");
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
            node.slots = raw.slots;
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
            const subflowData = await this.wsPkgData.resolveSharedBlock("subflow", raw.subflow);
            if (subflowData) {
                node.icon ??= subflowData.icon;
                node.inputHandleDefs = subflowData.data.inputs_def;
                node.outputHandleDefs = subflowData.data.outputs_def;
                node.slotNodeDefs = await this._getSlotNodeDefs(subflowData, "nodes");
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
        else if (typeof raw.conditions === "object" && raw.conditions) {
            node.type = NODE_TYPE.ConditionNode;
            node.inputHandleDefs = raw.inputs_def;
            node.conditionHandleDefs = raw.conditions.cases;
            node.defaultConditionHandleDef = raw.conditions.default;
            node.handleInputsFrom = raw.inputs_from;
        }
        else {
            // Not implemented.
            node.type = NODE_TYPE.ErrorNode;
            // XXX: Guess output handle defs from other nodes' inputs from.
        }

        return node;
    }

    private async _getSlotNodeDefs(blockData: SharedBlockData, field: "nodes" | "slot_nodes"): Promise<SlotNodeDef[] | undefined> {
        const slotNodeDefs: SlotNodeDef[] = [];
        for (const node of blockData.data[field] || []) {
            if (node.slot) {
                slotNodeDefs.push({
                    slot_node_id: node.node_id,
                    title: this.wsPkgData.localize(node.title),
                    icon: blockData.pkgData.resolveResourceURI(node.icon, blockData.blockDir),
                    description: this.wsPkgData.localize(node.description),
                    inputHandleDefs: node.slot.inputs_def,
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
}

class DepsQuery {
    private cache: Map<string, PkgData | null | Promise<PkgData | undefined>> = new Map();

    public constructor(public readonly searchPath: string, public readonly lang?: string) { }

    public async getPkgData(packageName: string, packageVersion: string): Promise<PkgData | undefined> {
        const packageId = `${packageName}-${packageVersion}`;
        if (this.cache.has(packageId)) {
            const pkgData = await this.cache.get(packageId);
            if (pkgData === null) {
                return;
            }
            if (pkgData) {
                return pkgData;
            }
        }
        const p = PkgData.create(this, packageName, packageVersion, path.join(this.searchPath, packageId), this.lang);
        this.cache.set(packageId, p);
        const pkgData = await p;
        this.cache.set(packageId, pkgData || null);
        return pkgData;
    }
}

class PkgData {
    public static async createWS(depsQuery: DepsQuery, workspaceDir: string, lang?: string): Promise<PkgData | undefined> {
        const packagePath = await resolveManifest(workspaceDir, "package");
        if (packagePath) {
            const data = await readManifestFile(packagePath);
            const localePath = await resolveLocaleFile(workspaceDir, lang);
            const userLocale = localePath ? await readJSONFile(localePath) : undefined;
            if (data && data.name && data.version) {
                return new PkgData(depsQuery, data.name, data.version, workspaceDir, packagePath, data, userLocale);
            }
        }
    }

    public static async create(depsQuery: DepsQuery, packageName: string, packageVersion: string, packageDir: string, lang?: string): Promise<PkgData | undefined> {
        const packagePath = await resolveManifest(packageDir, "package");
        if (packagePath) {
            const data = readManifestFile(packagePath);
            const localePath = await resolveLocaleFile(packageDir, lang);
            const userLocale = localePath ? await readJSONFile(localePath) : undefined;
            if (data) {
                return new PkgData(depsQuery, packageName, packageVersion, packageDir, packagePath, data, userLocale);
            }
        }
    }

    public readonly searchPath: string;

    public readonly title: string | undefined;
    public readonly description: string | undefined;
    public readonly icon: string | undefined;

    private readonly dependencies: Record<string, string>;
    private readonly sharedBlockCache: Map<string, SharedBlockData | null | Promise<SharedBlockData | undefined>> = new Map();

    private constructor(
        public readonly depsQuery: DepsQuery,
        public readonly packageName: string,
        public readonly packageVersion: string,
        public readonly packageDir: string,
        public readonly packagePath: string,
        public readonly data: Record<string, any>,
        public readonly userLocale?: Record<string, string | undefined>,
    ) {
        this.searchPath = depsQuery.searchPath;
        this.icon = this.resolveResourceURI(data.icon, packageDir);
        this.title = data.title || data.name;
        this.description = data.description;
        this.dependencies = isPlainObject(data.dependencies) ? data.dependencies : {};
    }

    public localize(str: string | undefined): string | undefined {
        if (str && str.startsWith("%") && str.endsWith("%") && str.length > 2) {
            const key = str.slice(1, -1);
            return this.userLocale?.[key] || str;
        }
        return str;
    }

    public resolveResourceURI(uri: string | undefined, manifestDir: string): string | undefined {
        if (!uri) {
            return;
        }

        if (uri.startsWith(":") && uri.endsWith(":")) {
            return uri;
        }

        if (uri.startsWith("https://") || uri.startsWith("http://") || uri.startsWith("data:")) {
            return uri;
        }

        if (!uri.startsWith("/")) {
            uri = path.join(manifestDir, uri);
        }

        if (uri.startsWith(this.packageDir)) {
            uri = path.relative(this.packageDir, uri);
        }

        if (!uri.startsWith("/")) {
            return `${assetsBaseUrl}${this.packageName}/${this.packageVersion}/files/package/${uri}`;
        }
    }

    public async resolveSharedBlock(blockType: "subflow", blockResourceName: string): Promise<SubflowBlockData | undefined>;
    public async resolveSharedBlock(blockType: SharedBlockType, blockResourceName: string): Promise<SharedBlockData | undefined>;
    public async resolveSharedBlock(blockType: SharedBlockType, blockResourceName: string): Promise<SharedBlockData | undefined> {
        const x = blockResourceName.split("::");
        if (x.length !== 2) {
            return;
        }
        const [blockPackage, blockName] = x;
        if (blockPackage === "self") {
            return this.getSharedBlockByName(blockType, blockName);
        }
        const version = this.dependencies[blockPackage];
        if (version) {
            const pkgData = await this.depsQuery.getPkgData(blockPackage, version);
            return pkgData?.getSharedBlockByName(blockType, blockName);
        }
    }

    public async getSharedBlockByName(blockType: "subflow", blockName: string): Promise<SubflowBlockData | undefined>;
    public async getSharedBlockByName(blockType: SharedBlockType, blockName: string): Promise<SharedBlockData | undefined>;
    public async getSharedBlockByName(blockType: SharedBlockType, blockName: string): Promise<SharedBlockData | undefined> {
        if (this.sharedBlockCache.has(blockName)) {
            const sharedBlockData = await this.sharedBlockCache.get(blockName);
            if (sharedBlockData === null) {
                return;
            }
            if (sharedBlockData) {
                return sharedBlockData;
            }
        }

        const p = blockType === "subflow" ? SubflowBlockData.create(this, blockName) : SharedBlockData.create(this, blockType, blockName);
        this.sharedBlockCache.set(blockName, p);
        const sharedBlockData = await p;
        this.sharedBlockCache.set(blockName, sharedBlockData || null);
        return sharedBlockData;
    }
}

type FlowLikeType = "flow" | "task" | "subflow";

class FlowLikeData {
    public static async create(pkgData: PkgData, manifestName: string, manifestDir: string, flowLikeType: FlowLikeType): Promise<FlowLikeData | undefined> {
        const flowLikePath = await resolveManifest(manifestDir, flowLikeType);
        if (flowLikePath) {
            const data = await readManifestFile(flowLikePath);
            if (data) {
                const uiData = await readJSONFile(path.join(manifestDir, flowUIOOJson));
                return new FlowLikeData(pkgData, flowLikeType, manifestName, manifestDir, flowLikePath, data, uiData);
            }
        }
    }

    public readonly title: string | undefined;
    public readonly description: string | undefined;
    public readonly icon: string | undefined;

    public constructor(
        public readonly pkgData: PkgData,
        public readonly flowLikeType: FlowLikeType,
        public readonly manifestName: string,
        public readonly manifestDir: string,
        public readonly manifestPath: string,
        public readonly data: Record<string, any>,
        public readonly uiData: Record<string, any> | undefined,
    ) {
        this.title = this.pkgData.localize(data.title) || manifestName;
        this.description = this.pkgData.localize(data.description);
        this.icon = this.pkgData.resolveResourceURI(data.icon, manifestDir);
    }
}

type SharedBlockType = "task" | "subflow";

class SharedBlockData {
    public static async create(pkgData: PkgData, blockType: SharedBlockType, blockName: string): Promise<SharedBlockData | undefined> {
        const blockDir = path.join(pkgData.packageDir, `${blockType}s`, blockName);
        const blockPath = await resolveManifest(blockDir, blockType);
        if (blockPath) {
            const data = await readManifestFile(blockPath);
            if (data) {
                return new SharedBlockData(pkgData, blockType, blockName, blockDir, blockPath, data);
            }
        }
    }

    public readonly title: string | undefined;
    public readonly description: string | undefined;
    public readonly icon: string | undefined;

    public constructor(
        public readonly pkgData: PkgData,
        public readonly blockType: SharedBlockType,
        public readonly blockName: string,
        public readonly blockDir: string,
        public readonly blockPath: string,
        public readonly data: Record<string, any>,
    ) {
        this.title = this.pkgData.localize(data.title) || blockName;
        this.description = this.pkgData.localize(data.description);
        this.icon = this.pkgData.resolveResourceURI(data.icon, blockDir) || pkgData.icon;
    }
}

class SubflowBlockData implements SharedBlockData, FlowLikeData {
    public static async create(pkgData: PkgData, subflowName: string): Promise<SubflowBlockData | undefined> {
        const manifestDir = path.join(pkgData.packageDir, "subflows", subflowName);
        const flowLikePath = await resolveManifest(manifestDir, "subflow");
        if (flowLikePath) {
            const data = await readManifestFile(flowLikePath);
            if (data) {
                const uiData = await readJSONFile(path.join(manifestDir, flowUIOOJson));
                return new SubflowBlockData(pkgData, "subflow", subflowName, manifestDir, flowLikePath, data, uiData);
            }
        }
    }

    public readonly title: string | undefined;
    public readonly description: string | undefined;
    public readonly icon: string | undefined;

    public readonly blockType: SharedBlockType;
    public readonly blockName: string;
    public readonly blockDir: string;
    public readonly blockPath: string;

    public constructor(
        public readonly pkgData: PkgData,
        public readonly flowLikeType: "subflow",
        public readonly manifestName: string,
        public readonly manifestDir: string,
        public readonly manifestPath: string,
        public readonly data: Record<string, any>,
        public readonly uiData: Record<string, any> | undefined,
    ) {
        this.title = this.pkgData.localize(data.title) || manifestName;
        this.description = this.pkgData.localize(data.description);
        this.icon = this.pkgData.resolveResourceURI(data.icon, manifestDir) || pkgData.icon;
        this.blockType = flowLikeType;
        this.blockName = manifestName;
        this.blockDir = manifestDir;
        this.blockPath = manifestPath;
    }
}

async function resolveLocaleFile(dirPath: string, lang?: string): Promise<string | undefined> {
    const filePath = path.join(dirPath, "oo-locales", `${lang || "en"}.json`);
    if (await isFile(filePath)) {
        return filePath;
    }
}

async function resolveManifest(dirPath: string, type: string): Promise<string | undefined> {
    let filePath = path.join(dirPath, `${type}.oo.yaml`);
    if (await isFile(filePath)) {
        return filePath;
    }
    filePath = path.join(dirPath, `${type}.oo.yml`);
    if (await isFile(filePath)) {
        return filePath;
    }
}

async function readManifestFile(manifestPath: string): Promise<Record<string, any> | undefined> {
    if (manifestFileCache.has(manifestPath)) {
        return manifestFileCache.get(manifestPath) || undefined;
    }
    try {
        const content = await readFile(manifestPath);
        if (content) {
            const data = YAML.parse(content);
            if (isPlainObject(data)) {
                manifestFileCache.set(manifestPath, data);
                return data;
            }
        }
        manifestFileCache.set(manifestPath, null);
    }
    catch {
        manifestFileCache.set(manifestPath, null);
        return undefined;
    }
}

async function readJSONFile(filePath: string): Promise<Record<string, any> | undefined> {
    try {
        const content = await readFile(filePath);
        if (content) {
            const data = JSON.parse(content);
            if (isPlainObject(data)) {
                return data;
            }
        }
    }
    catch { }
}

function isPlainObject(x: unknown): x is Record<string, any> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}
