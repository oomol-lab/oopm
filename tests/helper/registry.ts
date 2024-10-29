import { Buffer } from "node:buffer";
import Fastify from "fastify";
import getPort from "get-port";

export class Registry {
    private fastify = Fastify({
        logger: false,
    });

    public list = new Map<string, any>();

    public static async create() {
        const port = await getPort();
        const r = new Registry(port);
        r.registryRoutes();
        await r.start();
        return r;
    }

    private constructor(private readonly port: number) {
    }

    private async start() {
        await this.fastify.listen({
            port: this.port,
        });
    }

    public get endpoint() {
        return `http://localhost:${this.port}`;
    }

    public async close() {
        await this.fastify.close();
    }

    private registryRoutes() {
        this.fastify.put("/:package", async (req, res) => {
            const name = (req.params as any).package;
            const body = req.body as any;

            if (!this.list.has(name)) {
                this.list.set(name, body);
                return;
            }

            const info = this.list.get(name);
            info["dist-tags"] = body["dist-tags"];
            info.versions = {
                ...info.versions,
                ...body.versions,
            };
            info._attachments = {
                ...info._attachments,
                ...body._attachments,
            };

            this.list.set(name, info);

            return res.status(200).send({
                ok: true,
            });
        });

        this.fastify.get("/:package/-/:filename-:version.tgz", async (req, res) => {
            const name = (req.params as any).package;
            const version = (req.params as any).version;

            if (!this.list.has(name)) {
                return res.status(404).send({
                    error: "Not found",
                });
            }

            if (!this.list.get(name).versions[version]) {
                return res.status(404).send({
                    error: "Not found",
                });
            }

            res.header("Content-Type", "application/octet-stream");

            const data = this.getData(name, version);
            const buf = Buffer.from(data, "base64");

            return res.status(200).send(buf);
        });

        this.fastify.get("/:package", async (req, res) => {
            const name = (req.params as any).package;

            if (!this.list.has(name)) {
                return res.status(404).send({
                    error: "Not found",
                });
            }

            return res.status(200).send(this.list.get(name));
        });
    }

    public getData(name: string, version: string): string {
        const info = this.list.get(name);
        if (!info) {
            throw new Error(`Package ${name} not found`);
        }

        if (!info.versions[version]) {
            throw new Error(`Version ${version} not found`);
        }

        return info._attachments[`${name}-${version}.tgz`].data;
    }
}
