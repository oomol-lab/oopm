import { Buffer } from "node:buffer";
import path from "node:path";
import { pipeline } from "node:stream";
import * as tar from "tar";

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, "..", "..");

export function fixture(n: string): string {
    return path.join(root, "tests", "fixtures", n);
}

export function listFilesWithBase64Tar(data: string) {
    const buf = Buffer.from(data, "base64");
    const blob = new Blob([buf]);
    const stream = blob.stream();

    return new Promise<string[]>((r, j) => {
        const result: string[] = [];

        pipeline(stream, tar.t(), (err) => {
            if (err) {
                j(err);
            }
        })
            .on("entry", (entry) => {
                result.push(entry.path);
            })
            .on("finish", () => {
                r(result);
            });
    });
}
