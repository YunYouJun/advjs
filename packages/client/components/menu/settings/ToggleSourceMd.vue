<script lang="ts" setup>
import type { AdvMenuItemProps } from '@advjs/theme-default'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@advjs/client'

const settings = useSettingsStore()

const { t } = useI18n()
const item = computed<AdvMenuItemProps>(() => ({
  label: t('settings.script_path'),
  type: 'Select',
  props: {
    selected: settings.storage.play.mdUrl,
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
    change: (option) => {
      settings.storage.play.mdUrl = option?.value || ''
    },
  },
}))
</script>

<template>
  <MenuItem :item="item" />
</template>
