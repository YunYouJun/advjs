<template>
  <MenuItem :item="speechItem" />

  <template v-if="options.enable">
    <MenuItem :item="speechLanguageItem" />
  </template>
</template>

<script setup lang="ts">
import { speak } from '@advjs/shared/speech'
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()
const options = computed(() => {
  return settings.storage.speech
})

const speechItem = computed(
  () => ({
    label: '语音合成',
    type: 'Checkbox',
    props: {
      checked: options.value.enable,
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
  label: '语言种类',
  type: 'Select',
  props: {
    selected: options.value.language,
    options: voiceOptions.value.map(item => ({
      label: item.name,
      value: item.lang,
    })),
    change: (value: string) => {
      options.value.language = value
      speak('大家好，我是渣渣辉。', options.value.language)
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
