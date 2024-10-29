import "vitest";

declare module "vitest" {
    export interface TestContext {
        workdir: string;
        registry: import("../tests/helper/registry").Registry;
    }
}
