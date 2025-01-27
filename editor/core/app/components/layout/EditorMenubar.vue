<script lang="ts" setup>
import type { Menu } from '@advjs/gui'

const menus: Menu[] = [
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
