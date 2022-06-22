# @advjs/plugin-vite

[![NPM version](https://img.shields.io/npm/v/@advjs/plugin-vite?color=a1b858&label=)](https://www.npmjs.com/package/@advjs/plugin-vite)

## Dev

```bash
# test
pnpm run dev

# release with advjs
```

## Install

```bash
npm i @advjs/plugin-vite
```

```ts
// vite.config.ts
import Adv from '@advjs/plugin-vite'

export default defineConfig({
  plugins: [
    Adv({
      /* options */
    }),
  ],
})
```

## Ref

- [unplugin-starter](https://github.com/antfu/unplugin-starter)

## FAQ

为了避免后缀名为 `.md` 时与 `vite-plugin-md` 冲突，可以为其设置 `exclude`，并尽量使用 `.adv.md` 后缀名。

```ts
export default defineConfig({
  plugins: [
    Markdown({
      exclude: ['**/*.adv.md'],
    }),
  ],
})
```
