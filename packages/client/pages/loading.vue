<script lang="ts" setup>
import { useAdvConfig } from '@advjs/client'
import { useRouter } from 'vue-router'

const advConfig = useAdvConfig()
const router = useRouter()

function onLoaded() {
  router.push('/start')
}
</script>

<template>
  <StartLoading :assets="advConfig.assets" @loaded="onLoaded" />
</template>
