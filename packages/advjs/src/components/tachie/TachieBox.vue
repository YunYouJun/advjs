<template>
  <div class="tachie-box h-screen grid grid-cols-2">
    <tachie-character
      v-for="(character, i) in characters"
      :key="i"
      :character="character"
    />
  </div>
</template>

<script lang="ts">
import TachieCharacter from './TachieCharacter.vue'
export default {
  components: {
    TachieCharacter,
  },
  props: {
    characters: Array,
  },
}
</script>

<style lang="scss">
.tachie-box {
  padding-top: 6rem;
  overflow: hidden;
}
</style>
