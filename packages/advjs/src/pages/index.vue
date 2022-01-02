<template>
  <main
    class="
      w-screen
      h-screen
      opacity-90
      flex flex-col
      justify-center
      items-center
      animate-slow animate-fadeIn
    "
  >
    <NewYunLogo class="w-40 h-40" />
    <div class="font-bold">
      @YunYouJun
    </div>
  </main>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ duration?: number }>(), {
  duration: 3000,
})

const router = useRouter()
onMounted(() => {
  setTimeout(() => {
    router.push('/start')
  }, props.duration)
})
</script>

<route lang="yaml">
meta:
  layout: logo
</route>
