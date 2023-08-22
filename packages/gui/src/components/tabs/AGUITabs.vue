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
  <TabGroup as="div" class="agui-tab-group flex flex-col w-full">
    <TabList
      class="agui-tab-list flex justify-start bg-$agui-c-bg"
    >
      <Tab
        v-for="item in list"
        :key="item.title"
        v-slot="{ selected }"
        class="outline-none border-none"
      >
        <div
          class="agui-tab-btn inline-flex h-full justify-center items-center text-xs cursor-pointer text-white" :class="[
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

    <TabPanels>
      <slot />
    </TabPanels>
  </TabGroup>
</template>
