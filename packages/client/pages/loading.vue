<script lang="ts" setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function onLoaded() {
  router.push('/start')
}
</script>

<template>
  <StartLoading @loaded="onLoaded" />
</template>
