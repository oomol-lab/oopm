import process from "node:process";

export function env(registry: string): Record<string, string> {
    return {
        ...process.env,
        npm_config_registry: registry,
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
