<script lang="ts" setup>
import { useAdvContext } from '@advjs/client'
import { onMounted, ref } from 'vue'

const { $adv } = useAdvContext()

const rippleAnimation = ref(true)
onMounted(() => {
  rippleAnimation.value = false
})
</script>

<template>
  <Transition appear>
    <div
      class="adv-start-bg absolute h-full w-full bg-dark -z-1"
      bg="cover no-repeat center"
      :style="{ backgroundImage: `url(${$adv.gameConfig.value.cover})` }"
    />
  </Transition>
</template>
