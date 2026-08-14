<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="text-teal-700 px-4 py-10 text-center dark:text-gray-200">
    <div>
      <p class="text-4xl">
        <CarbonWarning class="inline-block" />
      </p>
    </div>
    <RouterView />
    <div>
      <button
        class="text-sm adv-btn m-3 mt-8"
        @click="router.back()"
      >
        {{ t('button.back') }}
      </button>
    </div>
  </main>
</template>
