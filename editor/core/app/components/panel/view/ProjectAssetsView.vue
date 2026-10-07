<script setup lang="ts">
import ProjectAssetBrowser from '../../project/ProjectAssetBrowser.vue'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
</script>

<template>
  <ProjectAssetBrowser :visible="visible" />
</template>
