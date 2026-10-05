<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <AdvThemeScope as="main" class="px-4 py-10 text-center text-$adv-c-text">
    <div text-4xl>
      <div i-carbon-warning class="inline-block" />
    </div>
    <RouterView />
    <div>
      <button
        class="adv-btn m-3 mt-8 text-sm"
        @click="router.back()"
      >
        {{ t('button.back') }}
      </button>
    </div>
  </AdvThemeScope>
</template>
