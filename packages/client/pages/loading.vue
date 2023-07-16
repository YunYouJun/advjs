<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { config } from '~/env'

const router = useRouter()

function onLoaded() {
  router.push('/start')
}
</script>

<template>
  <StartLoading :assets="config.assets" @loaded="onLoaded" />
</template>
