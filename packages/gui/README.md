# @advjs/gui

GUI for ADV.JS Engine.

## Usage

```ts
// common css
import '@advjs/gui/client/styles/index.scss'
```

### Import Icon CSS

```ts
import '@advjs/gui/dist/icons.css'
// or
```

Or you also can import icons by TypeScript:

```ts
import { mountCssVarsRootStyle } from '@advjs/gui/client'
import { onMounted } from 'vue'

onMounted(() => {
  mountCssVarsRootStyle()
})
```

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    // ...
    '@advjs/gui/nuxt',
  ],
})
```

## Thanks

- [radix-vue](https://github.com/radix-vue/radix-vue)
