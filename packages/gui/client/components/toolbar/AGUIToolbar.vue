<script lang="ts" setup>
import type { ToolbarItem } from './types'

import { ToggleGroupItem, ToggleGroupRoot, ToolbarButton, ToolbarRoot, ToolbarSeparator } from 'reka-ui'

defineProps<{
  items: ToolbarItem[]
}>()

const toggleGroupItemClasses
  = 'cursor-pointer bg-dark-200 shadow hover:bg-dark-100 text-mauve11 flex w-8 items-center justify-center text-base leading-4 first:rounded-l last:rounded-r focus:z-10 shadow focus:shadow-[0_0_0_1px] focus:shadow-dark-600 focus:outline-none'
</script>

<template>
  <ToolbarRoot
    class="h-$agui-toolbar-height w-full flex gap-1 bg-$agui-c-bg px-1.5 py-1 shadow-black/70"
    aria-label="Formatting options"
  >
    <slot name="before-toolbar" />

    <template v-for="(item, key) in items">
      <div v-if="item.type === 'space'" :key="key" class="flex flex-grow" />
      <ToolbarSeparator
        v-else-if="item.type === 'separator'"
        :key="`separator:${key}`"
        class="mx-1 my-2px w-1px bg-gray op-50"
      />
      <ToolbarButton
        v-else-if="item.type === 'button'"
        :key="item.name"
        class="agui-button h-20px"
        :title="item.title"
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

      <ToggleGroupRoot
        v-else-if="item.type === 'toggle-group'"
        :key="`group:${item.name}`"
        v-model="item.value"
        class="flex"
      >
        <ToggleGroupItem
          v-for="bItem in item.children"
          :key="bItem.value"
          :value="bItem.value"
          :aria-label="bItem.label"
          :class="`${bItem.class} ${toggleGroupItemClasses}`"
          @click="bItem.onClick"
        >
          <div :class="bItem.icon" class="h-[15px] w-[15px]" />
        </ToggleGroupItem>
      </ToggleGroupRoot>

      <AGUIDropdownMenu
        v-else-if="item.type === 'dropdown'"
        :key="`dropdown:${item.name}`"
        :data="item"
      />
    </template>

    <slot name="after-toolbar" />
  </ToolbarRoot>
</template>
