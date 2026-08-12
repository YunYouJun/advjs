<script setup lang="ts">
interface PageViewResponse {
  pageview: number
  startAt: number
}

const { data } = await useFetch<PageViewResponse>('/api/pageview')

const time = useTimeAgo(() => data.value?.startAt || 0)
</script>

<template>
  <div text-gray:80>
    <span text-gray font-500>{{ data?.pageview }}</span>
    page views since
    <span text-gray>{{ time }}</span>
  </div>
</template>
