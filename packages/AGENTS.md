# packages/ — Agent Guidelines

## Build Chain (order matters)

`@advjs/types` → `@advjs/parser` → `@advjs/core` → `advjs`

Run `pnpm build:advjs` from repo root to build in order. All publishable packages use **unbuild**; dev mode is `unbuild --stub`.

## Dependency Versions

All dependency versions are managed via **pnpm catalogs** defined in root `pnpm-workspace.yaml`. Never hardcode versions in package.json — use `catalog:` protocol (e.g. `"vue": "catalog:frontend"`).

## Non-Standard Architectures

### `advjs` — Dual entry (node + client)

This is NOT a standard single-entry package. It has two separate entry points:

- `./node/` — CLI (`adv` binary), Vite plugin setup, config resolution, theme resolution. Entry: `node/index.ts`
- `./client/` — Re-export for client-side. Entry: `client/index.ts`
- Exports: `"."` and `"./node"` → node, `"./client"` → client
- The `node/cli/` directory contains the CLI commands; `node/vite/` has Vite dev server setup

### `@advjs/client` — Source-only package

**No build step.** Exports raw `.ts`/`.vue` files directly (`"main": "index.ts"`). Consumed by Vite at dev/build time, not pre-compiled.

### `@advjs/shared` — Source-only, private

Same as client: no build, exports raw source. `private: true`.

### `@advjs/gui` — Multi-step build

Has a custom 3-step build (unlike other packages):

```bash
pnpm run build:lib      # vue-tsc typecheck + vite build
pnpm run build:icons    # tsx scripts/build.ts (icon generation)
pnpm run build:node     # unbuild (node entry)
```

Exports: `./client/*`, `./components/*`, `./nuxt`, `./node`, `./unocss`

### `@advjs/parser` — unified/remark ecosystem

Parses `.adv.md` files into AST. Has a secondary export `./fs` for filesystem operations. Built on unified/remark pipeline — when modifying parsing logic, understand the remark plugin chain.

## Packages That Are NOT Publishable

These are `private: true` or have no npm publishing setup:

- `@advjs/shared` — internal source-only utilities
- `@advjs/benchmarks` — perf benchmarks (run via `tsx`)
- `packages/webcontainer/` — no name, no build, private experiment
- `packages/flow/` — no package.json at directory level

## CLI Binaries

| Package             | Binary           | Command                |
| ------------------- | ---------------- | ---------------------- |
| `advjs`             | `adv`            | `./bin/adv.mjs`        |
| `create-adv`        | `create-adv`     | `./bin/index.mjs`      |
| `@advjs/mcp-server` | `adv-mcp-server` | `./bin/mcp-server.mjs` |

## Common Patterns

- **Console output**: use `consola` (not `console.log`)
- **Path manipulation**: use `pathe` (not `node:path`)
- **Build config**: `build.config.ts` at package root for unbuild
- **TSConfig aliases**: `@advjs/*` → `packages/*/src/index.ts`, `@advjs/client` → `packages/client/index.ts` (see root `tsconfig.json`)

## Do NOT

- Edit `dist/` directories — these are build outputs
- Use `npm` or `yarn` — this project enforces `pnpm` via preinstall hook
- Add dependencies without `catalog:` protocol
- Import `@advjs/client` or `@advjs/shared` from Node-only contexts (they contain Vue SFC / browser APIs)
