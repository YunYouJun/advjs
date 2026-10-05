<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <AdvIconButton :title="t('button.back')" class="cursor-pointer left-5 top-5 absolute">
    <AdvIcon>
      <div i-ri-arrow-left-line />
    </AdvIcon>
  </AdvIconButton>
</template>
