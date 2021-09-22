<template>
  <div class="tachie-box h-screen grid grid-cols-2">
    <TachieCharacter
      v-for="(character, i) in props.characters"
      :key="i"
      :character="character"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  characters: []
}>()
</script>

<style lang="scss">
.tachie-box {
  padding-top: 6rem;
  overflow: hidden;
}
</style>
