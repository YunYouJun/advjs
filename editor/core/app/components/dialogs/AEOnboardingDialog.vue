<script setup lang="ts">
const { t } = useI18n()
const { completeOnboarding } = useEditorLocale()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

async function selectLocale(code: 'en' | 'zh-CN') {
  await completeOnboarding(code)
  open.value = false
}

async function skip() {
  await completeOnboarding()
  open.value = false
}
</script>

<template>
  <AGUIDialog v-model:open="open" :title="t('onboarding.welcome')" content-class="w-md">
    <div class="p-8 flex flex-col gap-6 items-center">
      <div class="i-ri-translate-2 text-4xl op-60" />

      <h2 class="text-xl font-bold">
        {{ t('onboarding.selectLanguage') }}
      </h2>

      <div class="flex gap-4">
        <AGUIButton
          size=""
          class="text-base px-6 py-3 min-w-32"
          @click="selectLocale('en')"
        >
          English
        </AGUIButton>
        <AGUIButton
          size=""
          class="text-base px-6 py-3 min-w-32"
          @click="selectLocale('zh-CN')"
        >
          中文（简体）
        </AGUIButton>
      </div>

      <button
        class="text-sm op-40 cursor-pointer hover:op-70"
        @click="skip"
      >
        {{ t('onboarding.skip') }}
      </button>
    </div>
  </AGUIDialog>
</template>
