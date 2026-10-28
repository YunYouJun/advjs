<script lang="ts" setup>
import type { TabItem } from './types'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

defineProps<{
  defaultValue?: string
  list: TabItem[]
  label?: string
}>()
const model = defineModel<string | number>()
</script>

<template>
  <TabsRoot
    v-model="model"
    class="agui-tab-group flex flex-col h-full min-h-0 min-w-0 w-full"
    :default-value="defaultValue"
  >
    <div class="agui-tab-heading">
      <TabsList
        class="agui-tab-list"
        :aria-label="label || 'AETabs'"
      >
        <TabsTrigger
          v-for="item in list"
          :key="item.key"
          :value="item.key"
          class="agui-tab-btn"
        >
          <span v-if="item.icon" class="agui-tab-icon" :class="item.icon" aria-hidden="true" />
          <span>{{ item.title }}</span>
        </TabsTrigger>
      </TabsList>
      <div v-if="$slots.actions" class="agui-tab-actions">
        <slot name="actions" />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <slot />
    </div>
  </TabsRoot>
</template>

<style lang="scss">
.agui-tab-heading {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  min-width: 0;
  min-height: var(--agui-tab-list-height, 28px);
  background: var(--agui-c-bg-soft);
}
.agui-tab-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  padding: 2px 4px;

  &:empty {
    display: none;
  }
}
.agui-tab-list {
  display: flex;
  justify-content: flex-start;
  font-family: var(--agui-font-family-ui);
  min-height: var(--agui-tab-list-height, 28px);
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  line-height: var(--agui-control-line-height);

  .agui-tab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--agui-control-gap);
    box-sizing: border-box;
    min-height: var(--agui-tab-list-height, 28px);
    padding: 2px var(--agui-control-padding-x);
    appearance: none;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--agui-c-text-2);
    font-family: var(--agui-font-family-ui);
    font-size: var(--agui-font-size-body);
    font-weight: 400;
    flex: 0 0 auto;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--agui-motion-duration) var(--agui-motion-ease),
      color var(--agui-motion-duration) var(--agui-motion-ease);
  }

  .agui-tab-btn:hover:not([data-disabled]) {
    background: var(--agui-c-item-hover);
    color: var(--agui-c-text-1);
  }

  .agui-tab-btn:active:not([data-disabled]) {
    background: var(--agui-c-item-pressed);
  }

  .agui-tab-btn[data-state='active'] {
    background-color: var(--agui-c-bg-panel);
    color: var(--agui-c-text-1);
    box-shadow: inset 0 -2px var(--agui-c-focus);
  }

  .agui-tab-btn:focus-visible {
    outline: var(--agui-focus-width) solid var(--agui-c-focus);
    outline-offset: var(--agui-focus-offset);
  }

  .agui-tab-icon {
    flex-shrink: 0;
    width: var(--agui-icon-size);
    height: var(--agui-icon-size);
  }
}
</style>
