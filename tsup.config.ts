import { defineConfig } from "tsup";

export default defineConfig([
    {
        entry: ["src/index.ts"],
        outDir: "dist",
        format: ["cjs", "esm"],
        splitting: false,
        sourcemap: false,
        clean: true,
        treeshake: true,
        dts: true,
        minify: false,
    },
    {
        entry: ["src/bin.ts"],
        outDir: "dist",
        format: ["esm"],
        banner: {
            js: "#!/usr/bin/env node",
        },
        splitting: false,
        sourcemap: false,
        clean: true,
        treeshake: true,
        dts: false,
        minify: false,
    },
]);
