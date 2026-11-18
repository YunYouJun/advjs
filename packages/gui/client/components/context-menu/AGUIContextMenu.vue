<script setup lang="ts">
import type { AGUIContextMenuItemType } from './types'
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from 'reka-ui'
import AGUIContextMenuItem from './AGUIContextMenuItem.vue'

export type { AGUIContextMenuItemType }

withDefaults(defineProps<{
  contextMenu?: AGUIContextMenuItemType[]
}>(), {
  contextMenu: [
    {
      label: 'New Tab',
      accelerator: '⌘+T',
      // eslint-disable-next-line no-alert
      onClick: () => { alert('New Tab') },
    },
    {
      label: 'More Tools',
      children: [
        {
          label: 'Save Page As…',
          accelerator: '⌘+S',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Save Page As…') },
        },
        {
          label: 'Create Shortcut…',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Create Shortcut…') },
        },
        {
          label: 'Name Window…',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Name Window…') },
        },
        {
          type: 'separator',
        },
        {
          label: 'Developer Tools',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Developer Tools') },
        },
      ],
    },
    {
      label: 'New Window',
      accelerator: '⌘+N',
    },
    {
      label: 'New Private Window',
      accelerator: '⇧+⌘+N',
      disabled: true,
    },
    {
      label: 'More Tools',
      children: [
        {
          label: 'Save Page As…',
          accelerator: '⌘+S',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Save Page As…') },
        },
        {
          label: 'Create Shortcut…',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Create Shortcut…') },
        },
        {
          label: 'Name Window…',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Name Window…') },
        },
        {
          type: 'separator',
        },
        {
          label: 'Developer Tools',
          // eslint-disable-next-line no-alert
          onClick: () => { alert('Developer Tools') },
        },
        {
          label: 'More Tools',
          children: [
            {
              label: 'Save Page As…',
              accelerator: '⌘+S',
              // eslint-disable-next-line no-alert
              onClick: () => { alert('Save Page As…') },
            },
            {
              label: 'Create Shortcut…',
              // eslint-disable-next-line no-alert
              onClick: () => { alert('Create Shortcut…') },
            },
            {
              label: 'Name Window…',
              // eslint-disable-next-line no-alert
              onClick: () => { alert('Name Window…') },
            },
          ],
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Show Bookmarks',
      accelerator: '⌘+B',
      // eslint-disable-next-line no-alert
      onClick: () => { alert('Show Bookmarks') },
    },
    {
      label: 'Show Full URLs',
      // eslint-disable-next-line no-alert
      onClick: () => { alert('Show Full URLs') },
    },
    {
      type: 'separator',
    },
    {
      label: 'People',
      type: 'label',
    },
    {
      type: 'radio-group',
      children: [
        {
          label: 'Pedro Duarte',
          type: 'radio-item',
          value: 'pedro',
        },
        {
          label: 'Colm Tuite',
          type: 'radio-item',
          value: 'colm',
        },
      ],
    },
  ] as any,
})
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger
      as-child
      class="ContextMenuTrigger"
    >
      <slot name="trigger" />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="ContextMenuContent"
        :side-offset="5"
      >
        <AGUIContextMenuItem v-for="item in contextMenu" :key="item.id || item.label" :item="item" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style lang="scss">
.ContextMenuContent,
.ContextMenuSubContent {
  font-family: var(--agui-font-family-ui);
  min-width: 220px;
  max-width: calc(100vw - var(--agui-space-4));
  background-color: var(--agui-c-popup);
  border: 1px solid var(--agui-c-border);
  border-radius: var(--agui-radius-md);
  overflow: hidden;
  padding: var(--agui-space-1);
  box-shadow: var(--agui-shadow-popup);
}

.agui-context-menu-item,
.ContextMenuCheckboxItem,
.ContextMenuRadioItem,
.ContextMenuSubTrigger {
  box-sizing: border-box;
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-control-line-height);
  color: var(--agui-c-text-1);
  border-radius: var(--agui-radius-sm);
  display: flex;
  align-items: center;
  min-height: var(--agui-control-height);
  gap: var(--agui-control-gap);
  padding: 2px var(--agui-control-padding-x);
  position: relative;
  padding-left: calc(var(--agui-control-height) + var(--agui-space-1));
  overflow-wrap: anywhere;
  user-select: none;
  outline: none;
}
.ContextMenuSubTrigger[data-state='open'] {
  background-color: var(--agui-c-selection);
  color: var(--agui-c-selection-text);
}
.agui-context-menu-item[data-disabled],
.ContextMenuCheckboxItem[data-disabled],
.ContextMenuRadioItem[data-disabled],
.ContextMenuSubTrigger[data-disabled] {
  color: var(--agui-c-text-3);
  pointer-events: none;
}
.agui-context-menu-item[data-highlighted],
.ContextMenuCheckboxItem[data-highlighted],
.ContextMenuRadioItem[data-highlighted],
.ContextMenuSubTrigger[data-highlighted] {
  background-color: var(--agui-c-selection);
  color: var(--agui-c-selection-text);
}

:is(.ContextMenuContent, .ContextMenuSubContent):not(:has([data-highlighted]))
  :is(.agui-context-menu-item, .ContextMenuCheckboxItem, .ContextMenuRadioItem, .ContextMenuSubTrigger):not(
    [data-disabled]
  ):hover {
  background-color: var(--agui-c-item-hover);
}

:is(.agui-context-menu-item, .ContextMenuCheckboxItem, .ContextMenuRadioItem, .ContextMenuSubTrigger):not(
    [data-disabled]
  ):active {
  background-color: var(--agui-c-item-pressed);
  color: var(--agui-c-text-1);
}

:is(.agui-context-menu-item, .ContextMenuCheckboxItem, .ContextMenuRadioItem, .ContextMenuSubTrigger):focus-visible {
  outline: var(--agui-focus-width) solid var(--agui-c-focus);
  outline-offset: var(--agui-focus-offset);
}

.agui-context-menu-label {
  padding: 2px var(--agui-control-padding-x);
  padding-left: calc(var(--agui-control-height) + var(--agui-space-1));
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-control-line-height);
  color: var(--agui-c-text-2);
}

.ContextMenuSeparator {
  height: 1px;
  background-color: var(--agui-c-divider-light);
  margin: var(--agui-space-1);
}

.ContextMenuItemIndicator {
  position: absolute;
  left: 0;
  width: var(--agui-control-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  > * {
    width: var(--agui-icon-size);
    height: var(--agui-icon-size);
  }
}

.RightSlot {
  margin-left: auto;
  flex-shrink: 0;
  padding-left: var(--agui-space-4);
  color: var(--agui-c-text-2);
}
[data-highlighted] > .RightSlot {
  color: inherit;
}
[data-disabled] .RightSlot {
  color: var(--agui-c-text-4);
}

.agui-context-menu-content {
  background-color: var(--agui-c-popup);
}
</style>
