import { cpus } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // eslint-disable-next-line node/prefer-global/process
        reporters: process.env.GITHUB_ACTIONS ? ["github-actions", "verbose"] : ["default"],
        maxConcurrency: cpus().length - 1,
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts", "src/bin.ts", "src/**/*.test.ts"],
            enabled: true,
        },
        sequence: {
            concurrent: true,
        },
    },
    define: {
        __TEST__: "true",
    },
});
