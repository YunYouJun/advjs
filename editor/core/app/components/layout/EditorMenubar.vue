<script lang="ts" setup>
import type { Menu } from '@advjs/gui'

const fileStore = useFileStore()

const menus: Menu[] = [
  {
    name: 'File',
    items: [
      {
        label: 'New Window',
        accelerator: '⌘ N',
      },
      {
        type: 'separator',
      },
      {
        type: 'submenu',
        label: 'Share...',
        children: [
          {
            label: 'Email Link',
          },
          { label: 'Messages' },
          { label: 'Copy Link' },
          { label: 'Copy QR Code' },
        ],
      },
      {
        label: 'Open ADV Config File',
        onClick: async () => {
          fileStore.openAdvConfigFile()
        },
      },
    ],
  },
  {
    name: 'Window',
    items: [
      {
        type: 'checkbox',
        label: 'Show Full URLs',
        accelerator: 'CmdOrCtrl+Shift+U',
        checked: true,
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('Show Full URLs')
        },
      },
    ],
  },
]
</script>

<template>
  <AGUIMenubar :menus="menus" />
</template>
