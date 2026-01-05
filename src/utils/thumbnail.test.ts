import { describe, expect, it } from "vitest";
import { fixture } from "../../tests/helper/fs";
import { Thumbnail } from "./thumbnail";

describe("thumbnail Smoke Test", () => {
    it("should return localized package thumbnail", async () => {
        const thumbnail = await Thumbnail.create(fixture("oo_project_1"), [], "en");

        const data = await thumbnail?.provideThumbnail();

        expect(data).toEqual(expect.objectContaining({
            title: "Project 1",
            description: "This is the description for Project 1.",
        }));
    });
});
