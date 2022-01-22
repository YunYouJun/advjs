<template>
  <div class="h-full w-full absolute" :style="advGameStyle" />
</template>

<script lang="ts" setup>

const advGameStyle = computed(() => {
  return {
    backgroundImage: 'url("/img/bg/night.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
})
</script>
