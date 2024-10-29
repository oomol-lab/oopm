## oopm

OOMOL Package Manager

### Installation

```bash
pnpm add oopm
# or
pnpm add oopm -g
```

### Usage

```bash
oopm pack ./path/to/package

oopm install
oopm install package-name package-name2@version
oopm install ./path/to/package/
oopm install ./path/to/package.tgz

oopm publish
oopm publish ./path/to/package
```

### API

```ts
import { pack, publish, install } from "oopm";

// pack(path: string, ignore: string[] = ["node_modules", ".git", ".DS_Store"])
await pack("./path/to/package");
await pack("./path/to/package", ["node_modules", "dist"]);

// publish(path: string, token?: string)
// token is optional, if not provided, it will use the token in the .npmrc file
await publish("./path/to/package");
await publish("./path/to/package", "TOKEN");

// install(options: InstallAllOptions | InstallFileOptions | InstallPackageOptions)
// InstallAllOptions -> { distDir: string, all: true, workdir: string, token?: string }
// InstallFileOptions -> { distDir: string, file: string }
// InstallPackageOptions -> { distDir: string, workdir: string, deps: DepRaw[], token?: string, save: boolean }
// DepRaw -> { name: string, version?: string }
await install({
    distDir: "./path/to/dist",
    all: true,
    workdir: "./path/to/workdir",
    token: "TOKEN"
});
await install({
    distDir: "./path/to/dist",
    file: "./path/to/package.tgz"
});
await install({
    distDir: "./path/to/dist",
    workdir: "./path/to/workdir",
    deps: [
        { name: "package-name", version: "1.0.0" },
        { name: "package-name2" }
    ],
    token: "TOKEN",
    save: true
});
```
