<template>
  <MenuItem :item="item" />
</template>

<script lang="ts" setup>
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()

const item = computed(() => ({
  label: '剧本路径',
  type: 'select',
  selected: settings.advMdUrl,
  options: [
    {
      label: '仓鼠（测试）',
      value: '/md/test.adv.md',
    },
    {
      label: '武林外传（第一回）',
      value: '/md/wlwz.adv.md',
    },
  ].map(item => ({
    label: item.label + item.value,
    value: item.value,
  })),
  change: (value: string) => {
    settings.advMdUrl = value
  },
}))
</script>
