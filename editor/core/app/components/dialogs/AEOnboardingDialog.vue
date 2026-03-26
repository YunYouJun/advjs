<script setup lang="ts">
import { useStorage } from '@vueuse/core'

const { t } = useI18n()
const { changeLocale } = useEditorLocale()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const onboarded = useStorage('advjs:editor:onboarded', false)

function selectLocale(code: string) {
  changeLocale(code)
  onboarded.value = true
  open.value = false
}

function skip() {
  onboarded.value = true
  open.value = false
}
</script>

<template>
  <AGUIDialog v-model:open="open" :title="t('onboarding.welcome')" content-class="w-md">
    <div class="flex flex-col items-center gap-6 p-8">
      <div class="i-ri-translate-2 text-4xl op-60" />

      <h2 class="text-xl font-bold">
        {{ t('onboarding.selectLanguage') }}
      </h2>

      <div class="flex gap-4">
        <AGUIButton
          size="default"
          class="min-w-32 px-6 py-3 text-base"
          @click="selectLocale('en')"
        >
          English
        </AGUIButton>
        <AGUIButton
          size="default"
          class="min-w-32 px-6 py-3 text-base"
          @click="selectLocale('zh-CN')"
        >
          中文（简体）
        </AGUIButton>
      </div>

      <button
        class="cursor-pointer text-sm op-40 hover:op-70"
        @click="skip"
      >
        {{ t('onboarding.skip') }}
      </button>
    </div>
  </AGUIDialog>
</template>
