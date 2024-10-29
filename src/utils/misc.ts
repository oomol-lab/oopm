import process from "node:process";
import { registry } from "../const";

export function env(): Record<string, string> {
    return {
        ...process.env,
        /* v8 ignore next 1 */
        npm_config_registry: __TEST__ ? process.env.CUSTOM_REGISTRY || registry : registry,
        npm_config_save_exact: "true", // always save exact versions
        npm_config_install_strategy: "hoisted", // hoist dependencies
        npm_config_prefer_dedupe: "false", // don't dedupe dependencies
        npm_config_ignore_scripts: "true", // don't run scripts
        npm_config_audit: "false", // don't run audit
        npm_config_fund: "false", // don't show funding message
    };
}

export function nerfURL(url: string) {
    const parsed = new URL(url);
    const from = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    const rel = new URL(".", from);
    return `//${rel.host}${rel.pathname}`;
}
