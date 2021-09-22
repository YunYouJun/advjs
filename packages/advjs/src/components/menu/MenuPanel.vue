<template>
  <div class="menu-panel grid grid-cols-12 gap-16">
    <div class="col-span-12">
      <h1 class="adv-font-serif text-4xl font-black mt-6">
        {{ title }}
      </h1>
    </div>
    <FullScreen />
    <SpeechSynthesis />
  </div>
</template>

<script setup lang="ts">
const title = ref('设置')
</script>
