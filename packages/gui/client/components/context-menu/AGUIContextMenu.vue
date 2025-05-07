<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from 'reka-ui'
import AGUIContextMenuItem from './AGUIContextMenuItem.vue'

export interface AGUIContextMenuItemType {
  id?: string
  label: string
  icon?: string
  type?: 'separator' | 'label' | 'radio-group' | 'radio-item'
  disabled?: boolean
  accelerator?: string
  children?: AGUIContextMenuItemType[]
  onClick: () => void
}

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

<style>
@import '@radix-ui/colors/black-alpha.css';
</style>

<style lang="scss">
// trigger
// .ContextMenuTrigger {}

.ContextMenuContent,
.ContextMenuSubContent {
  min-width: 220px;
  background-color: rgba(22, 22, 22, 0.95);
  border-radius: 6px;
  overflow: hidden;
  padding: 5px;
  box-shadow:
    0px 8px 15px -5px rgba(22, 23, 24, 0.4),
    0px 8px 8px -8px rgba(22, 23, 24, 0.2);
}

.agui-context-menu-item,
.ContextMenuCheckboxItem,
.ContextMenuRadioItem,
.ContextMenuSubTrigger {
  font-size: 13px;
  line-height: 1;
  color: var(--agui-c-text);
  border-radius: 3px;
  display: flex;
  align-items: center;
  height: 25px;
  padding: 0 5px;
  position: relative;
  padding-left: 25px;
  user-select: none;
  outline: none;
}
.ContextMenuSubTrigger[data-state='open'] {
  background-color: var(--agui-c-active);
  color: var(--agui-c-text-1);
}
.agui-context-menu-item[data-disabled],
.ContextMenuCheckboxItem[data-disabled],
.ContextMenuRadioItem[data-disabled],
.ContextMenuSubTrigger[data-disabled] {
  color: var(--agui-c-text-3);
  pointer-events: 'none';
}
.agui-context-menu-item[data-highlighted],
.ContextMenuCheckboxItem[data-highlighted],
.ContextMenuRadioItem[data-highlighted],
.ContextMenuSubTrigger[data-highlighted] {
  background-color: var(--agui-c-active);
  color: white;
}

.agui-context-menu-label {
  padding-left: 25px;
  font-size: 12px;
  line-height: 25px;
  color: var(--agui-c-text-2);
}

.ContextMenuSeparator {
  height: 1px;
  background-color: var(--black-a6);
  margin: 5px;
}

.ContextMenuItemIndicator {
  position: absolute;
  left: 0;
  width: 25px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.RightSlot {
  margin-left: auto;
  padding-left: 20px;
  color: var(--agui-c-text-3);
}
[data-highlighted] > .RightSlot {
  color: white;
}
[data-disabled] .RightSlot {
  color: var(--agui-c-text-4);
}

.agui-context-menu-content {
  background-color: rgba(33, 33, 33, 0.9);
}
</style>
