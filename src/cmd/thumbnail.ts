import path from "node:path";
import { ooThumbnailName } from "../const";
import { writeFile } from "../utils/fs";
import { Thumbnail } from "../utils/thumbnail";

export async function thumbnail(workdir: string, searchDir: string): Promise<string | undefined> {
    const thumbnail = await Thumbnail.create(workdir, searchDir);
    if (!thumbnail) {
        return;
    }
    const result = await thumbnail.provideThumbnail();
    if (result) {
        const ooThumbnailPath = path.join(workdir, ooThumbnailName);
        await writeFile(ooThumbnailPath, JSON.stringify(result));
        return ooThumbnailPath;
    }
}
