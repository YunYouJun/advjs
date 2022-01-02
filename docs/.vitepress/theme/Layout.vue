<script lang="ts" setup>
import Layout from '../../node_modules/vitepress-theme-you/src/vitepress/components/VPApp.vue'
import ParallelFigure from './components/ParallelFigure.vue';
</script>

<template>
  <Layout>
    <template #home-hero>
      <ParallelFigure />
    </template>
  </Layout>
</template>
