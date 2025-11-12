export const ooPackageName = "package.oo.yaml";
export const ooThumbnailName = ".oo-thumbnail.json";
export const ooLanguages = ["en", "zh-CN"];
export const ooThumbnailNames = /* #__PURE__ */ ooLanguages.map((lang) => {
    return lang === "en" ? ooThumbnailName : ooThumbnailName.replace(".json", `.${lang}.json`);
});

export const ERR_OOPM_DEPEND_ITSELF = new Error("ERR_OOPM_DEPEND_ITSELF: Not allowed to depend on itself");
