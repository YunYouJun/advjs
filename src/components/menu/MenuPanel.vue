<template>
  <div class="menu-panel grid grid-cols-12 gap-16">
    <div class="col-span-12">
      <h1 class="adv-font-serif text-4xl font-black">{{ title }}</h1>
    </div>
    <speech-synthesis />
  </div>
</template>

<script>
import SpeechSynthesis from './speech/SpeechSynthesis.vue';
export default {
  components: {
    SpeechSynthesis,
  },
  data() {
    return {
      title: '设置',
    };
  },
  mounted() {
    const synth = window.speechSynthesis;
    setTimeout(() => {
      this.voices = synth.getVoices();
    }, 1000);
  },
};
</script>

<style lang="scss">
.menu-panel {
  color: white;
}
.adv-input-checkbox {
  &:checked {
    display: block;
    content: '\2714';
    text-align: center;
    color: white;
  }
}
.adv-select {
  background-color: transparent;
  font-size: 2rem;
  padding: 0.2rem;
  outline: none;
}
</style>
