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
        class="agui-tab-list bg-$agui-c-bg-soft flex justify-start"
        :aria-label="label || 'AETabs'"
      >
        <TabsTrigger
          v-for="item in list"
          :key="item.key"
          :value="item.key"
          class="agui-tab-btn border-none inline-flex"
        >
          <div
            class="text-xs text-$agui-c-text-1 inline-flex h-full cursor-pointer items-center justify-center"
            mr-1 px-2
          >
            <div v-if="item.icon" mr-1 :class="item.icon" />
            <div>
              {{ item.title }}
            </div>
          </div>
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
  min-height: var(--agui-tab-list-height, 28px);
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  line-height: 1.4;

  .agui-tab-btn {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .active {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }

  .agui-tab-btn[data-state='inactive'] {
    opacity: 1;
  }

  .agui-tab-btn[data-state='active'] {
    opacity: 0.8;
    background-color: var(--agui-c-bg-panel);
    color: var(--agui-c-text);
  }
}
</style>
