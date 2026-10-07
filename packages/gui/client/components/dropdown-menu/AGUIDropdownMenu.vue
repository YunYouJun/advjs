<script setup lang="ts">
import type { ToolbarDropdown } from '../toolbar/types'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { ref } from 'vue'
import './dropdown-menu.scss'

defineProps<{
  data: ToolbarDropdown
}>()

const toggleState = ref(false)
</script>

<template>
  <DropdownMenuRoot v-model:open="toggleState">
    <DropdownMenuTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuTrigger
      v-else
      class="agui-button"
      :aria-label="data.title"
      :title="data.title"
    >
      <div
        v-if="data.icon"
        :class="[data.icon, data.name && 'mr-1']"
      />
      <span>
        {{ data.name }}
      </span>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        class="agui-dropdown-menu-content"
        :side-offset="5"
      >
        <template v-for="(item, key) in data.children" :key="key">
          <DropdownMenuItem
            v-if="item.type === 'item'"
            class="agui-dropdown-menu-item"
            :disabled="item.disabled"
            @select="item.onClick"
          >
            <div
              v-if="item.icon"
              class="mr-1" :class="[item.icon]"
            />
            {{ item.label }}
          </DropdownMenuItem>
          <DropdownMenuSeparator
            v-else-if="item.type === 'separator'"
            class="my-1 bg-$agui-c-divider h-[1px]"
          />
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
