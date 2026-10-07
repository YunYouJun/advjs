<script setup lang="ts">
import type { AGUISidebarMenuItem } from './types'

defineProps<{
  menu: AGUISidebarMenuItem[]
}>()

const activeKey = defineModel<string>('active-key')
</script>

<template>
  <div flex="~ col" class="sidebar text-$agui-c-text-1 bg-$agui-c-bg-soft h-full w-12 shadow">
    <AGUISidebarItem
      v-for="item in menu" :key="item.key"
      :item="item"
      :active="activeKey === item.key"
      @click="() => {
        activeKey = item.key
        item.onClick?.()
      }"
    />
  </div>
</template>
