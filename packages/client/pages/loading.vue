<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { useAdvConfig } from '@advjs/client'

const advConfig = useAdvConfig()
const router = useRouter()

function onLoaded() {
  router.push('/start')
}
</script>

<template>
  <StartLoading :assets="advConfig.assets" @loaded="onLoaded" />
</template>
