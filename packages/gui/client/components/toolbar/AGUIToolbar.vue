<script lang="ts" setup>
import { ToolbarButton, ToolbarRoot, ToolbarSeparator } from 'radix-vue'
import type { ToolbarItem } from './types'

defineProps<{
  items: ToolbarItem[]
}>()
</script>

<template>
  <ToolbarRoot
    class="shadow-blackA7 w-full flex gap-1 p-1"
    aria-label="Formatting options"
  >
    <!-- <ToolbarSeparator class="bg-mauve6 mx-[10px] w-[1px]" /> -->

    <template v-for="(item, key) in items">
      <div v-if="item.type === 'space'" :key="key" class="flex flex-grow" />
      <ToolbarSeparator
        v-if="item.type === 'separator'"
        :key="key"
        class="mx-1 my-2px w-1px bg-gray op-50"
      />
      <ToolbarButton
        v-else-if="item.type === 'button'"
        :key="item.name"
        class="agui-button h-20px"
        @click="item.onClick"
      >
        <div
          v-if="item.icon"
          :class="[item.icon, item.name && 'mr-1']"
        />
        <span>
          {{ item.name }}
        </span>
      </ToolbarButton>
    </template>
  </ToolbarRoot>
</template>
