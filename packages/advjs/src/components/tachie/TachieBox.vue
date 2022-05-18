<script setup lang="ts">
import { useAppStore } from '~/stores/app'
import { adv } from '~/setup/adv'

const app = useAppStore()

const advStore = adv.store
const tachies = computed(() => advStore.cur.value.tachies)
</script>

<template>
  <transition enter-active-class="animate-fadeInLeft" leave-active-class="animate-fadeOutLeft">
    <div v-if="app.showTachie" grid="~ cols-2" class="tachie-box absolute pointer-events-none animate-animated" w="full" h="full">
      <TachieCharacter
        v-for="character in tachies" :key="character.character"
        :character="character"
      />
    </div>
  </transition>
</template>

<style lang="scss">
.tachie-box {
  overflow: hidden;
}
</style>
