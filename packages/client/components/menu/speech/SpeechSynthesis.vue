<script setup lang="ts">
// import { speak } from '@advjs/shared/speech'
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { useSpeechSynthesis } from '@vueuse/core'
import { computed, onMounted, reactive, ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()
const sOptions = reactive(settings.storage.speechOptions)
const speech = useSpeechSynthesis('', sOptions)

const { t } = useI18n()
const speechItem = computed(
  () => ({
    label: t('settings.speech_synthesis'),
    type: 'Checkbox',
    props: {
      checked: settings.storage.speech,
      onClick: () => {
        settings.storage.speech = !settings.storage.speech
      },
    },
  } as AdvMenuItemProps),
)

const voiceOptions = ref([
  {
    name: '普通话（中国大陆）',
    lang: 'zh-CN',
  },
  {
    name: '粤语（中国香港）',
    lang: 'zh-HK',
  },
  {
    name: '國語（中國臺灣）',
    lang: 'zh-TW',
  },
])

const speechLanguageItem = computed<AdvMenuItemProps>(() => ({
  type: 'Select',
  label: t('settings.speech_language'),
  props: {
    selected: sOptions.lang as string || 'zh-HK',
    options: voiceOptions.value.map(item => ({
      label: item.name,
      value: item.lang,
    })),
    change: (options) => {
      settings.speechContent = options.value
      sOptions.lang = options.value
      speech.speak()
    },
  },
}))

onMounted(() => {
  const synth = window.speechSynthesis
  setTimeout(() => {
    voiceOptions.value = synth.getVoices()
  }, 1000)
})
</script>

<template>
  <MenuItem :item="speechItem" />

  <template v-if="settings.speech">
    <MenuItem :item="speechLanguageItem" />
  </template>
</template>
