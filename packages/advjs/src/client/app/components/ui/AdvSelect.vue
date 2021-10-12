<template>
  <select v-model="settings.speech.options.language" class="adv-select" @change="speakTest">
    <option v-for="voice in voiceOptions" :key="voice.lang" :value="voice.lang">
      {{ voice.name }}
    </option>
  </select>
</template>

<script setup lang="ts">
</script>
