<script setup lang="ts">
import { computed, ref } from 'vue'

const pominisId = ref('')
const authToken = ref('')

const gameUrl = computed(() => {
  // return windlow. `https://play.pominis.com/${pominisId.value}?auth=${authToken.value}`
  const url = new URL(window.location.href)
  url.pathname = `/start`
  url.searchParams.set('pominisId', pominisId.value)
  if (authToken.value) {
    url.searchParams.set('token', authToken.value)
  }
  return url.toString()
})

const onlineGameUrl = computed(() => {
  const url = new URL(gameUrl.value)
  url.protocol = 'https:'
  url.hostname = 'play.pominis.com'
  url.port = ''
  return url.toString()
})
</script>

<template>
  <div>
    <h2>
      生成游戏 URL
    </h2>

    <div class="my-4 flex flex-col gap-2">
      <t-input v-model="pominisId" placeholder="Pominis ID" />
      <t-input v-model="authToken" placeholder="Auth Token" />
    </div>

    <div class="flex flex-col gap-2">
      <a :href="gameUrl" target="_blank" class="text-blue-500 hover:underline">
        {{ gameUrl }}
      </a>
      <a :href="onlineGameUrl" target="_blank" class="text-blue-500 hover:underline">
        {{ onlineGameUrl }}
      </a>
    </div>
  </div>
</template>
