<script lang="ts" setup>
import Layout from 'vitepress/client/theme-default/Layout.vue'
import ParallelFigure from './components/ParallelFigure.vue'
</script>

<template>
  <Layout>
    <template #home-hero>
      <ParallelFigure />
    </template>
  </Layout>
</template>
