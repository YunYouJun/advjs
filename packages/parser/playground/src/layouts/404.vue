<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="px-4 py-10 text-center text-blue-700 dark:text-gray-200">
    <div text-4xl>
      <div i-carbon-warning class="inline-block" />
    </div>
    <router-view />
    <div>
      <button class="btn m-3 text-sm mt-8" @click="router.back()">
        {{ t('button.back') }}
      </button>
    </div>
  </main>
</template>
