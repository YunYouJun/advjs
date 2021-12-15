# unplugin-adv

[![NPM version](https://img.shields.io/npm/v/unplugin-adv?color=a1b858&label=)](https://www.npmjs.com/package/unplugin-adv)

## Dev

```bash
# test
pnpm run dev

# release
pnpm run release
```

## Install

```bash
npm i unplugin-adv
```

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import Adv from 'unplugin-adv/vite';

export default defineConfig({
  plugins: [
    Adv({
      /* options */
    }),
  ],
});
```

Example: [`playground/`](./playground/)

<br></details>

<details>
<summary>Rollup</summary><br>

```ts
// rollup.config.js
import Starter from 'unplugin-adv/rollup';

export default {
  plugins: [
    Starter({
      /* options */
    }),
  ],
};
```

<br></details>

<details>
<summary>Webpack</summary><br>

```ts
// webpack.config.js
module.exports = {
  /* ... */
  plugins: [
    require('unplugin-adv/webpack')({
      /* options */
    }),
  ],
};
```

<br></details>

<details>
<summary>Nuxt</summary><br>

```ts
// nuxt.config.js
export default {
  buildModules: [
    [
      'unplugin-adv/nuxt',
      {
        /* options */
      },
    ],
  ],
};
```

> This module works for both Nuxt 2 and [Nuxt Vite](https://github.com/nuxt/vite)

<br></details>

<details>
<summary>Vue CLI</summary><br>

```ts
// vue.config.js
module.exports = {
  configureWebpack: {
    plugins: [
      require('unplugin-adv/webpack')({
        /* options */
      }),
    ],
  },
};
```

<br></details>

## Ref

- [unplugin-starter](https://github.com/antfu/unplugin-starter)

## FAQ

为了避免后缀名为 `.md` 时与 `vite-plugin-md` 冲突，可以为其设置 `exclude`。

```ts
export default defineConfig({
  // ...
  plugins: [
    Markdown({
      // ...,
      exclude: [path.resolve(__dirname, '../examples/*.md')],
      // ...
    }),
  ],
});
```
