<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <div>
    <AdvIconButton :title="t('button.back')" class="cursor-pointer left-5 top-5 absolute" @click="router.go(-1)">
      <AdvIcon>
        <div i-ri-arrow-left-line />
      </AdvIcon>
    </AdvIconButton>
  </div>
</template>
