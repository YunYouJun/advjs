<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

import { useAppStore } from '../../stores'

const { t } = useI18n()

const app = useAppStore()

function onClick() {
  app.rotate()
}
</script>

<template>
  <AdvIconButton :title="t('button.rotate')" @click="onClick()">
    <div i-ri-clockwise-line />
  </AdvIconButton>
</template>
