<template>
  <div class="col-span-4 text-right adv-menu-item">
    <label for="speechSynthesisSwitch">语音合成</label>
  </div>
  <div class="col-span-8 text-left">
    <!-- <icon-font
      :name="
        settings.speech.options.enable
          ? 'checkbox-line'
          : 'checkbox-blank-line'
      "
      size="3rem"
      @click="settings.speech.toggleStatus"
    /> -->
    <AdvCheckbox :check="settings.speech.options.enable" @click="settings.speech.toggleStatus" />
  </div>

  <template v-if="settings.speech.options.enable">
    <div class="col-span-4 text-right adv-menu-item">
      <label for="speechSynthesisLanguage">语言种类</label>
    </div>
    <div class="col-span-8 text-left">
      <select v-model="settings.speech.options.language" class="adv-select" @change="speakTest">
        <option
          v-for="voice in voiceOptions"
          :key="voice.lang"
          :value="voice.lang"
        >
          {{ voice.name }}
        </option>
      </select>
    </div>
  </template>
</template>

<script setup lang="ts">
import { speak } from '@advjs/shared/speech'
import { useSettingsStore } from '~/stores/settings'

const settings = useSettingsStore()

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

function speakTest() {
  speak('大家好，我是渣渣辉。', settings.speech.options.language)
}

onMounted(() => {
  const synth = window.speechSynthesis
  setTimeout(() => {
    voiceOptions.value = synth.getVoices()
  }, 1000)
})
</script>
