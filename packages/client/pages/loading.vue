<script lang="ts" setup>
import { useRouter } from 'vue-router'
import * as assets from '~/assets'

const router = useRouter()

const onLoaded = () => {
  router.push('/start')
}
</script>

<template>
  <StartLoading :assets="assets" @loaded="onLoaded" />
</template>
