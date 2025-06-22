# vite-plugin-adv

> 考虑到 ADV.JS 利用了 Vite 的诸多特性，因此不考虑采用 Unplugin 方式构建通用插件。

用于组合式构建配置 Vite API 相关的插件。

它将会用于抽取替代 advjs 部分配置 vite 的内容。

## Usage

当你配置 ADV 插件后，你不再需要配置：

- `vite-plugin-vue-i18n`
- `unplugin-vue-router`
- `unplugin-vue-components`
- `vite-plugin-vue-layouts`
- `unocss`

```ts
import ADV from 'vite-plugin-adv'

export default defineConfig({
  plugins: [
    ADV({
      // 这里可以配置 ADV.JS 的相关选项
    })
  ]
})
```
