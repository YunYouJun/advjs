<template>
  <div class="col-span-4 text-right adv-menu-item">
    <label for="speechSynthesisSwitch">语音合成</label>
  </div>
  <div class="col-span-8 text-left">
    <icon-font
      :name="
        $store.state.settings.speechSynthesis.enable
          ? 'checkbox-line'
          : 'checkbox-blank-line'
      "
      size="3rem"
      @click="$store.commit('settings/speechSynthesis/toggleStatus')"
    />
  </div>

  <template v-if="$store.state.settings.speechSynthesis.enable">
    <div class="col-span-4 text-right adv-menu-item">
      <label for="speechSynthesisLanguage">语言种类</label>
    </div>
    <div class="col-span-8 text-left">
      <select class="adv-select" v-model="speechLanguage" @change="speakTest">
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

<script>
import { speak } from '@advjs/shared/speech';
export default {
  data() {
    return {
      voiceOptions: [
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
      ],
    };
  },
  computed: {
    speechLanguage: {
      get() {
        return this.$store.state.settings.speechSynthesis.language;
      },
      set(value) {
        this.$store.commit('settings/speechSynthesis/setLanguage', value);
      },
    },
  },
  methods: {
    speakTest() {
      speak('大家好，我是渣渣辉。', this.speechLanguage);
    },
  },
  mounted() {
    const synth = window.speechSynthesis;
    setTimeout(() => {
      this.voices = synth.getVoices();
    }, 1000);
  },
};
</script>
