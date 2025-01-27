<script setup lang="ts">
import type { AGUISidebarMenuItem } from './types'

defineProps<{
  menu: AGUISidebarMenuItem[]
}>()

const activeKey = defineModel('active-key', {
  type: String,
  default: false,
  required: false,
})
</script>

<template>
  <div flex="~ col" class="sidebar h-full w-12 bg-$agui-c-bg-soft text-white shadow">
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
