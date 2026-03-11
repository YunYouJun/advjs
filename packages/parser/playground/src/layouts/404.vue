<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="text-blue-700 px-4 py-10 text-center dark:text-gray-200">
    <div text-4xl>
      <div i-carbon-warning class="inline-block" />
    </div>
    <RouterView />
    <div>
      <button class="text-sm btn m-3 mt-8" @click="router.back()">
        {{ t('button.back') }}
      </button>
    </div>
  </main>
</template>
