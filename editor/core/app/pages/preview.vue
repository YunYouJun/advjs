<script setup lang="ts">
import { computed } from 'vue'
import ModelPreview from '../components/preview/ModelPreview.vue'

const route = useRoute()
// Vue Router already decodes query values; decoding again corrupts encoded asset URLs.
const fileUrl = computed(() => String([route.query.fileUrl].flat()[0] ?? ''))
const type = computed(() => String([route.query.type].flat()[0] ?? ''))
</script>

<template>
  <ClientOnly>
    <ModelPreview :src="fileUrl" :type="type" />
  </ClientOnly>
</template>
