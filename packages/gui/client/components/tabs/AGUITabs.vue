<script lang="ts" setup>
import { Tab, TabGroup, TabList, TabPanels } from '@headlessui/vue'
import type { TabItem } from './types'

defineProps<{
  list: TabItem[]
}>()
</script>

<template>
  <TabGroup as="div" class="agui-tab-group h-full w-full flex flex-col">
    <TabList
      class="agui-tab-list flex justify-start bg-$agui-c-bg-soft"
    >
      <Tab
        v-for="item in list"
        :key="item.title"
        v-slot="{ selected }"
        class="inline-flex border-none outline-none"
      >
        <div
          class="agui-tab-btn h-full inline-flex cursor-pointer items-center justify-center text-xs text-white"
          :class="[
            selected
              ? 'active bg-$agui-c-bg-panel text-white'
              : 'op-80',
          ]"
          mr-1 px-2
        >
          <div v-if="item.icon" mr-1 :class="item.icon" />
          <div>
            {{ item.title }}
          </div>
        </div>
      </Tab>
    </TabList>

    <TabPanels style="height:calc(100% - 20px)" overflow-y="auto">
      <slot />
    </TabPanels>
  </TabGroup>
</template>

<style lang="scss">
.agui-tab-list {
  height: var(--agui-tab-list-height, 20px);
  line-height: 1.4;

  .active {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }
}
</style>
