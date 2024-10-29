import { defineConfig } from "tsup";

const define = {
    __TEST__: "false",
};

export default defineConfig([
    {
        entry: ["src/index.ts"],
        define,
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
        define,
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
