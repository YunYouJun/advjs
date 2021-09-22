<template>
  <header>
    <h1>
      Demo for
      <a :href="pkg.homepage" target="_blank">{{ pkg.name }}</a>
      <br />
      <span class="zi-tag success">{{ pkg.version }}</span>
    </h1>
  </header>
  <GithubCorner />
  <parse-preview />
</template>

<script setup lang="ts">
import pkg from '@advjs/parser/package.json'
import GithubCorner from './components/GithubCorner.vue'
import ParsePreview from './components/ParsePreview.vue'
</script>

<style>
header h1 {
  text-align: center;
}
</style>
