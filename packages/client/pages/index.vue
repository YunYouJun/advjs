<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{ duration?: number }>(), {
  duration: 2000,
})

const router = useRouter()
onMounted(() => {
  setTimeout(() => {
    router.push('/start')
  }, props.duration)
})
</script>

<template>
  <main
    class="
      w-screen
      h-screen
      opacity-90
      flex flex-col
      justify-center
      items-center
      animate__animated animate__fadeIn
    "
  >
    <NewYunLogo class="w-40 h-40" />
    <div class="font-bold">
      @YunYouJun
    </div>
  </main>
</template>

<route lang="yaml">
meta:
  layout: logo
</route>
