<template>
  <MenuItem :item="speechItem" />

  <template v-if="settings.speech.options.enable">
    <MenuItem :item="speechLanguageItem" />
  </template>
</template>

<script setup lang="ts">
import { speak } from '@advjs/shared/speech'
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()

const speechItem = computed(
  () => ({
    label: '语音合成',
    type: 'Checkbox',
    props: {
      checked: settings.speech.options.enable,
      click: () => {
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
  label: '语言种类',
  type: 'Select',
  props: {
    selected: settings.speech.options.language,
    options: voiceOptions.value.map(item => ({
      label: item.name,
      value: item.lang,
    })),
    change: (value: string) => {
      settings.speech.options.language = value
      speak('大家好，我是渣渣辉。', settings.speech.options.language)
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
