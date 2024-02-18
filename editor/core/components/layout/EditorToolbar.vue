<script setup lang="ts">
import type { ToolbarItem } from '@advjs/gui'

const app = useAppStore()

const tools: ToolbarItem[] = [
  {
    type: 'button',
    icon: 'i-mdi-account-circle',
    name: 'YunYouJun',
    onClick: () => {
      // eslint-disable-next-line no-console
      console.log('YunYouJun')
    },
  },
  {
    type: 'button',
    icon: 'i-ri-puzzle-line',
    onClick: () => {
      // eslint-disable-next-line no-console
      console.log('puzzle')
    },
  },
  {
    type: 'separator',
  },
  {
    type: 'button',
    icon: 'i-ri-puzzle-2-line',
    onClick: () => {
      // eslint-disable-next-line no-console
      console.log('puzzle 2')
    },
  },
  {
    type: 'space',
  },
  {
    type: 'space',
  },
  {
    type: 'button',
    name: 'Reset Layout',
    onClick: () => {
      app.resetLayout()
    },
  },
]
</script>

<template>
  <AGUIToolbar :items="tools">
    asd
  </AGUIToolbar>
</template>
