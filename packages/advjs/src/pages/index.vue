<template>
  <i-ri-video-chat-line class="adv-logo m-auto text-8xl" alt="ADV logo" />
  <HelloWorld msg="Welcome to ADV.JS" />
  <!-- <div class="grid-cols-2">
    <div>asd</div>
    <div>asd</div>
  </div>
  <button @click="settings.toggleFullScreen">
    Go Fullscreen
  </button>
  <button @click="screenLock">
    Go Fullscreen
  </button> -->
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<script setup lang="ts">
// import { useSettingsStore } from '~/stores/settings'
// const settings = useSettingsStore()

// const screenLock = async() => {
//   await screen.orientation.lock('landscape').catch(e => alert(e.message))
// }

onMounted(async() => {})
</script>
