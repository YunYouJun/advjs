<script lang="ts" setup>
import { Tab, TabGroup, TabList, TabPanels } from '@headlessui/vue'

export interface TabItem {
  title: string
  key: string
  icon?: string
}

defineProps<{
  list: TabItem[]
}>()
</script>

<template>
  <TabGroup as="div" class="agui-tab-group w-full flex flex-col">
    <TabList
      class="agui-tab-list flex justify-start bg-$agui-c-bg-soft"
    >
      <Tab
        v-for="item in list"
        :key="item.title"
        v-slot="{ selected }"
        class="border-none outline-none"
      >
        <div
          class="agui-tab-btn h-full inline-flex cursor-pointer items-center justify-center text-xs text-white" :class="[
            selected
              ? 'active bg-$agui-c-bg-panel text-white'
              : 'op-80',
          ]"
          mr-1 px-2
        >
          <div mr-1 :class="item.icon" />
          <span>{{ item.title }}</span>
        </div>
      </Tab>
    </TabList>

    <TabPanels class="h-full">
      <slot />
    </TabPanels>
  </TabGroup>
</template>
