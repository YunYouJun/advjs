<script lang="ts" setup>
import Layout from 'vitepress-theme-you/Layout.vue'
import ParallelFigure from './components/ParallelFigure.vue';
</script>

<template>
  <Layout>
    <template #home-hero>
      <ParallelFigure />
    </template>
  </Layout>
</template>
