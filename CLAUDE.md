# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADV.JS is a front-end ADV (Adventure/Visual Novel) game engine built with Vue 3, Vite, and TypeScript. It uses a Markdown-based scripting language (`.adv.md`) parsed into an AST for game dialogue and scenes. Licensed under MPL-2.0.

## Common Commands

```bash
pnpm install                    # Install dependencies (pnpm only, enforced via preinstall)
pnpm build                      # Build all packages (packages/* only)
pnpm dev                        # Dev mode for all packages + plugins in parallel
pnpm lint                       # ESLint (uses @antfu/eslint-config with UnoCSS + formatters)
pnpm test                       # Run unit tests with Vitest (jsdom environment)
pnpm e2e                        # Run Playwright e2e tests
pnpm e2e:ui                     # Playwright e2e with interactive UI
pnpm typecheck                  # vue-tsc type checking

# Run a single unit test file
pnpm vitest run tests/unit/basic.test.ts

# Dev specific packages
pnpm demo                       # Run demo/starter dev server
pnpm editor                     # Run editor dev server
pnpm play                       # Run playground dev server
pnpm docs                       # Run docs dev server
```

## Build Order

Packages have dependencies that require ordered builds:
`@advjs/types` → `@advjs/parser` → `@advjs/core` → `advjs`

Use `pnpm build:advjs` to build the full chain in order.

## Monorepo Architecture

Managed with pnpm workspaces. Dependency versions use pnpm catalogs (defined in `pnpm-workspace.yaml`).

### Key Packages (`packages/`)

- **`@advjs/types`** — Shared TypeScript type declarations for the entire project
- **`@advjs/parser`** — Markdown-to-AST parser using unified/remark ecosystem. Parses `.adv.md` files into a structured AST for the game engine
- **`@advjs/core`** — Core engine library: game engine runtime, session management, i18n, VRM model support
- **`advjs`** — Main entry package with CLI (`adv` binary), Vite plugin integration, node/client split architecture, theme resolution
- **`@advjs/client`** — Vue 3 client app: pages, layouts, components, composables, Pixi.js integration
- **`@advjs/gui`** — GUI components (publishable)
- **`@advjs/shared`** — Shared utilities between node and client
- **`@advjs/vite-plugin-adv`** — Vite plugin for ADV.JS
- **`@advjs/flow`** — Visual flow/node editor using Vue Flow

### Plugins (`plugins/`)

External integrations: Babylon.js 3D (`plugin-babylon`), Three.js (`plugin-three`), Tencent COS storage (`plugin-cos`), Feishu/Lark (`plugin-feishu`), OBS WebSocket (`plugin-obs`), OpenAI (`plugin-openai`), Runware AI images (`plugin-runware`), Playwright automation (`plugin-playwright`), Pominis characters (`plugin-pominis`).

### Themes (`themes/`)

`theme-default`, `theme-pominis`, `theme-starter` — ADV.JS themes following a convention similar to Slidev themes.

### Editor (`editor/`)

- `editor/core` — Web-based visual editor (Nuxt app at editor.advjs.org)
- `editor/vrm` — VRM 3D model editor for character animations/expressions

### Build Tooling

- All packages use **unbuild** for building
- The `advjs` main package uses **Vite** for its client-side bundling
- UnoCSS config at root re-exports from `editor/core/uno.config`

## Testing

- **Unit tests**: `tests/unit/` — Vitest with jsdom, Vue plugin enabled
- **E2E tests**: `tests/e2e/` — Playwright against `demo/starter` (dev server on port 3333)
- Vitest excludes `**/e2e/**` from unit test runs

## Code Style

- ESLint via `@antfu/eslint-config` (Anthony Fu's opinionated config)
- UnoCSS linting enabled
- Formatters enabled (replaces Prettier)
- Lint-staged runs on `*.{js,ts,vue}` files via Husky pre-commit hooks
- TypeScript strict mode with `verbatimModuleSyntax`

## TSConfig Path Aliases

Key aliases defined in `tsconfig.json`:
- `@advjs/*` → `packages/*/src/index.ts`
- `@advjs/client` → `packages/client/index.ts`
- `@advjs/editor/*` → `editor/core/*`
- `@advjs/theme-default` → `themes/theme-default/index.ts`
- `advjs` → `packages/advjs/node/index.ts`
- `~/*` → `packages/client/*`

## Node Version

Requires Node.js `^20.19.0 || >=22.12.0`.
