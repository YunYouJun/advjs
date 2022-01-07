<template>
  <div class="flex justify-center items-center">
    <span class="mr-2">x:</span>
    <div class="inline-flex adv-slider-container">
      <input v-model="bonesRotation[bone].x" class="adv-slider w-40" type="range" min="0" :max="Math.PI * 2" step="0.01" text="black" @input="update(bone)">
    </div>
    <input v-model="bonesRotation[bone].x" class="adv-slider-input" step="0.1" @input="update(bone)">
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  modelValue: number
  onInput: () => void
}>()
</script>
