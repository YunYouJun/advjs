<script lang="ts" setup>
import type { AGUIBreadcrumbItem } from './types'

defineProps<{
  items: AGUIBreadcrumbItem[]
}>()
</script>

<template>
  <nav class="agui-breadcrumb-container" aria-label="breadcrumb">
    <ol class="agui-breadcrumb">
      <li v-for="(item, index) in items" :key="index" class="agui-breadcrumb-item" :class="{ active: index === items.length - 1 }">
        <a
          v-if="index < items.length - 1"
          :href="item.href"
          @click.prevent="item.onClick?.()"
        >{{ item.label }}</a>
        <span v-else>{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style lang="scss">
.agui-breadcrumb-container {
  display: flex;
  background-color: var(--agui-c-bg-panel-title);

  height: 20px;

  .agui-breadcrumb {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 4px;
    background: transparent;

    font-size: 12px;
    line-height: 1;
  }

  .agui-breadcrumb-item {
    margin: 0;

    a {
      cursor: pointer;
      color: #ccc;
      text-decoration: none;
    }

    &.active {
      color: #eee;
      font-weight: bold;
    }
  }

  .agui-breadcrumb-item + .agui-breadcrumb-item::before {
    content: '>';
    padding: 0 5px;
    color: #6c757d;
  }
}
</style>
