import fsP from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

export async function tempDir() {
    return await fsP.mkdtemp(path.join(os.tmpdir(), "oopm-"));
}

export async function move(src: string, dest: string) {
    try {
        await fsP.rename(src, dest);
    }
    catch (err) {
        // See: https://stackoverflow.com/questions/43206198/what-does-the-exdev-cross-device-link-not-permitted-error-mean
        if ((err as NodeJS.ErrnoException).code !== "EXDEV") {
            throw err;
        }

        await moveAcrossDevice(src, dest);
    }
}

async function moveAcrossDevice(src: string, dest: string) {
    await copyDir(src, dest);
    await remove(src);
}

export async function copyDir(src: string, dest: string, filter?: (src: string, dest: string, source: string, destination: string) => boolean) {
    await fsP.cp(src, dest, {
        recursive: true,
        force: true,
        filter(source: string, destination: string): boolean | Promise<boolean> {
            if (filter) {
                return filter(src, dest, source, destination);
            }
            return true;
        },
    });
}

export async function remove(p: string) {
    await fsP.rm(p, {
        recursive: true,
        force: true,
    });
}

export async function exists(p: string) {
    try {
        await fsP.access(p);
        return true;
    }
    catch {
        return false;
    }
}

export async function readFile(p: string) {
    return await fsP.readFile(p, "utf8");
}

export async function writeFile(p: string, data: string) {
    await fsP.writeFile(p, data, {
        encoding: "utf8",
        flush: true,
    });
}

export async function mkdir(p: string) {
    await fsP.mkdir(p, {
        recursive: true,
    });
}

export async function xTar(tarball: string) {
    const temp = await tempDir();
    await tar.x({
        file: tarball,
        C: temp,
    });

    // package/package/* -> ./
    await move(path.join(temp, "package"), path.join(temp, "package_temp"));
    await copyDir(path.join(temp, "package_temp", "package"), path.join(temp));
    await remove(path.join(temp, "package_temp"));

    return temp;
}
