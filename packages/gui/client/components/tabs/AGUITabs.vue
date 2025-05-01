<script lang="ts" setup>
import type { TabItem } from './types'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

defineProps<{
  defaultValue?: string
  list: TabItem[]
}>()
</script>

<template>
  <TabsRoot
    class="agui-tab-group h-full w-full flex flex-col"
    :default-value="defaultValue"
  >
    <TabsList
      class="agui-tab-list flex justify-start bg-$agui-c-bg-soft"
      aria-label="AETabs"
    >
      <TabsTrigger
        v-for="item in list"
        :key="item.title"
        :value="item.key"
        class="agui-tab-btn inline-flex border-none outline-none"
      >
        <div
          class="h-full inline-flex cursor-pointer items-center justify-center text-xs text-white"
          mr-1 px-2
        >
          <div v-if="item.icon" mr-1 :class="item.icon" />
          <div>
            {{ item.title }}
          </div>
        </div>
      </TabsTrigger>
    </TabsList>

    <div style="height:calc(100% - 20px)" overflow-y="auto">
      <slot />
    </div>
  </TabsRoot>
</template>

<style lang="scss">
.agui-tab-list {
  height: var(--agui-tab-list-height, 20px);
  line-height: 1.4;

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
