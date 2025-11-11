import path from "node:path";
import { ooLanguages, ooThumbnailNames } from "../const";
import { writeFile } from "../utils/fs";
import { Thumbnail } from "../utils/thumbnail";

export async function thumbnail(workdir: string, searchDir: string): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < ooLanguages.length; i++) {
        const lang = ooLanguages[i];
        const ooThumbnailName = ooThumbnailNames[i];
        const thumbnailPath = await thumbnailInternal(workdir, searchDir, lang, ooThumbnailName);
        if (thumbnailPath) {
            result.push(thumbnailPath);
        }
    }

    Thumbnail.clearCache();
    return result;
}

async function thumbnailInternal(workdir: string, searchDir: string, lang: string, ooThumbnailName: string): Promise<string | undefined> {
    const thumbnail = await Thumbnail.create(workdir, searchDir, lang);
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
