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
          :href="item.href || '#'"
          @click.prevent="item.onClick?.()"
        >{{ item.label }}</a>
        <span v-else aria-current="location">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style lang="scss">
.agui-breadcrumb-container {
  display: flex;
  background-color: var(--agui-c-bg-panel-title);

  min-height: 24px;
  flex-shrink: 0;
  overflow-x: auto;

  .agui-breadcrumb {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 4px;
    background: transparent;

    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
  }

  .agui-breadcrumb-item {
    margin: 0;

    a {
      cursor: pointer;
      color: var(--agui-c-text-2);
      &:focus-visible {
        outline: 2px solid var(--agui-c-focus);
        outline-offset: 1px;
      }
      text-decoration: none;
    }

    &.active {
      color: var(--agui-c-text-1);
      font-weight: 500;
    }
  }

  .agui-breadcrumb-item + .agui-breadcrumb-item::before {
    content: '>';
    padding: 0 5px;
    color: var(--agui-c-text-2);
  }
}
</style>
