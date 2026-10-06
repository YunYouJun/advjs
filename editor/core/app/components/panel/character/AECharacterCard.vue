<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'

const props = defineProps<{
  character: AdvCharacter
}>()

const app = useAppStore()
const cStore = useCharacterStore()

function onClickCharacter() {
  app.activeInspector = 'character'
  cStore.selectedCharacter = props.character
}
</script>

<template>
  <CharacterCard :character="character" :selected="cStore.selectedCharacter?.id === character.id" @click="onClickCharacter" />
</template>
