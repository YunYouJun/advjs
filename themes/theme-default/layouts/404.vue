<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="px-4 py-10 text-center text-blue-700 dark:text-gray-200">
    <div text-4xl>
      <div i-carbon-warning class="inline-block" />
    </div>
    <RouterView />
    <div>
      <button
        class="m-3 mt-8 btn text-sm"
        @click="router.back()"
      >
        {{ t('button.back') }}
      </button>
    </div>
  </main>
</template>
