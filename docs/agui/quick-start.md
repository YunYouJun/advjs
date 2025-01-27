# Quick Start

> 🧪 Will be released soon.

[![npm](https://img.shields.io/npm/v/@advjs/gui)](https://www.npmjs.com/package/@advjs/gui)

[介绍](/agui/)

## Usage

### 组件库方式

```bash
pnpm add @advjs/gui
```

#### Vue

```ts
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
// vite.config.ts
// with unplugin-vue-components
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    Vue(),
    Components({
      dirs: ['@advjs/gui/components'],
    }),
  ],
})
```

#### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    // ...
    '@advjs/gui/nuxt',
  ],
})
```

### API 方式
