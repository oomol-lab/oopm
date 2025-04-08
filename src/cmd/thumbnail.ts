import path from "node:path";
import { ooThumbnailName } from "../const";
import { writeFile } from "../utils/fs";
import { Thumbnail } from "../utils/thumbnail";

export async function thumbnail(workdir: string, searchDir: string): Promise<string | undefined> {
    const result = await new Thumbnail(workdir, searchDir).provideThumbnail();
    if (result) {
        const ooThumbnailPath = path.join(workdir, ooThumbnailName);
        await writeFile(ooThumbnailPath, JSON.stringify(result));
        return ooThumbnailPath;
    }
}
