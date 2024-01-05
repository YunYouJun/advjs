<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  ContextMenuItem,
  ContextMenuItemIndicator,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from 'radix-vue'
import type { AGUIContextMenuItemType } from './types'

defineProps<{
  item: AGUIContextMenuItemType
}>()
</script>

<template>
  <ContextMenuSeparator
    v-if="item.type === 'separator'"
    class="ContextMenuSeparator"
  />
  <ContextMenuLabel
    v-else-if="item.type === 'label'"
    class="agui-context-menu-label"
  >
    {{ item.label }}
  </ContextMenuLabel>
  <ContextMenuRadioGroup
    v-else-if="item.type === 'radio-group'"
  >
    <!-- todo: v-model -->
    <template v-for="subItem in item.children" :key="subItem.id || subItem.label">
      <ContextMenuRadioItem
        v-if="subItem.type === 'radio-item'"
        class="agui-context-menu-item"
        :value="subItem.label"
      >
        <ContextMenuItemIndicator class="ContextMenuItemIndicator">
          <Icon icon="radix-icons:dot-filled" />
        </ContextMenuItemIndicator>
        {{ subItem.label }}
      </ContextMenuRadioItem>
    </template>
  </ContextMenuRadioGroup>
  <ContextMenuItem
    v-else-if="!item.children"
    :value="item.label"
    class="agui-context-menu-item"
    :disabled="item.disabled"
    @click="item.onClick"
  >
    <ContextMenuItemIndicator class="ContextMenuItemIndicator">
      <Icon v-if="item.icon" :icon="item.icon" />
    </ContextMenuItemIndicator>

    {{ item.label }}
    <div v-if="item.accelerator" class="RightSlot">
      {{ item.accelerator }}
    </div>
  </ContextMenuItem>
  <ContextMenuSub v-else>
    <ContextMenuSubTrigger
      :value="item.label"
      class="ContextMenuSubTrigger"
    >
      {{ item.label }}
      <div class="RightSlot">
        <Icon icon="radix-icons:chevron-right" />
      </div>
    </ContextMenuSubTrigger>
    <ContextMenuPortal>
      <ContextMenuSubContent
        class="ContextMenuSubContent"
        :side-offset="2" :align-offset="-5"
      >
        <AGUIContextMenuItem v-for="subItem in item.children" :key="subItem.id || subItem.label" :item="subItem" />
      </ContextMenuSubContent>
    </ContextMenuPortal>
  </ContextMenuSub>
</template>
