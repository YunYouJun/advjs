<template>
  <div class="col-span-1 flex flex-col justify-end items-center">
    <img
      :class="characterClass"
      :style="character.style"
      :src="character.tachies[character.status]"
      :alt="character.name"
    />
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue'
interface Character {
  name: string
  path: string
  active?: boolean
  class?: string[]
  style?: any
}

export default {
  props: {
    character: {
      type: Object as PropType<Character>,
    },
  },
  computed: {
    characterClass(): string[] {
      const defaultClass = ['tachie-character', 'inline-block', 'transform']
      let resultClass = defaultClass
      if (this.character) {
        if (this.character.class)
          resultClass = defaultClass.concat(this.character.class)

        if (!this.character.active)
          resultClass.push('inactive-character')
      }
      return resultClass
    },
  },
}
</script>

<style lang="scss">
.tachie-character {
  max-width: 40%;
}

.inactive-character {
  filter: brightness(50%);
}
</style>
