<template>
  <MenuItem :item="speechItem" />

  <template v-if="speechOptions.enable">
    <MenuItem :item="speechLanguageItem" />
  </template>
</template>

<script setup lang="ts">
import { speak } from '@advjs/shared/speech'
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()
const speechOptions = computed(() => {
  return settings.storage.speech
})

const { t } = useI18n()
const speechItem = computed(
  () => ({
    label: t('settings.speech_synthesis'),
    type: 'Checkbox',
    props: {
      checked: speechOptions.value.enable,
      onClick: () => {
        settings.speech.toggleStatus()
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
  label: t('settings.speech_language'),
  type: 'Select',
  props: {
    selected: speechOptions.value.language,
    options: voiceOptions.value.map(item => ({
      label: item.name,
      value: item.lang,
    })),
    change: (options) => {
      speechOptions.value.language = options.value
      speak('大家好，我是渣渣辉。', options.value)
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
