<script lang="ts" setup>
import type { ToolbarItem } from './types'

import { ToolbarButton, ToolbarRoot, ToolbarSeparator, ToolbarToggleGroup, ToolbarToggleItem } from 'reka-ui'
import AGUIButton from '../button/AGUIButton.vue'
import AGUIIconButton from '../button/AGUIIconButton.vue'
import AGUIDropdownMenu from '../dropdown-menu/AGUIDropdownMenu.vue'

withDefaults(defineProps<{
  items: ToolbarItem[]
  label?: string
}>(), { label: 'Tools' })
</script>

<template>
  <ToolbarRoot
    class="agui-toolbar"
    :aria-label="label"
  >
    <slot name="before-toolbar" />

    <template v-for="(item, key) in items">
      <div v-if="item.type === 'space'" :key="key" class="flex flex-grow" />
      <ToolbarSeparator
        v-else-if="item.type === 'separator'"
        :key="`separator:${key}`"
        class="agui-toolbar-separator"
      />
      <ToolbarButton
        v-else-if="item.type === 'button'"
        :key="`button:${key}`"
        as-child
      >
        <component :is="item.name ? AGUIButton : AGUIIconButton" :aria-label="item.name || item.title" :title="item.title" :icon="item.icon" @click="item.onClick">
          {{ item.name }}
        </component>
      </ToolbarButton>

      <ToolbarToggleGroup
        v-else-if="item.type === 'toggle-group'"
        :key="`group:${item.name}`"
        v-model="item.value"
        class="flex"
      >
        <ToolbarToggleItem
          v-for="bItem in item.children"
          :key="bItem.value"
          :value="bItem.value"
          as-child
        >
          <AGUIIconButton :class="bItem.class" :icon="bItem.icon" :title="bItem.label" :active="item.value === bItem.value" @click="bItem.onClick" />
        </ToolbarToggleItem>
      </ToolbarToggleGroup>

      <AGUIDropdownMenu
        v-else-if="item.type === 'dropdown'"
        :key="`dropdown:${item.name}`"
        :data="item"
      />
    </template>

    <slot name="after-toolbar" />
  </ToolbarRoot>
</template>

<style lang="scss">
.agui-toolbar {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 3px 6px;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel-title);
  border-bottom: 1px solid var(--agui-c-divider);
  font-size: 12px;
  line-height: 1.5;
}

.agui-toolbar-separator {
  align-self: stretch;
  width: 1px;
  margin: 2px 4px;
  background: var(--agui-c-divider);
}
</style>
