# ADV.JS Studio — Agent Guidelines

## Ionic Vue Slot 规则

Ionic Vue 组件底层是 Web Components，**必须使用原生 `slot` 属性**，不能用 Vue 的 `<template #slotName>` 语法。

```html
<!-- ❌ -->
<template #start>
  <IonIcon :icon="icon" />
</template>

<!-- ✅ -->
<IonIcon slot="start" :icon="icon" />
```

多个子元素放入同一 slot 时，用容器 `<div>` 包裹：

```vue
<div slot="start" class="tree-slot-start">
  <IonIcon :icon="chevronForwardOutline" />
  <span class="tree-icon" />
</div>
```

> `vue/no-deprecated-slot-attribute` 已在 `.eslintrc.cjs` 中全局关闭，无需逐行添加 eslint-disable 注释。
