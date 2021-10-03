<template>
  <header>
    <h1 class="text-center">
      Demo for
      <a :href="pkg.homepage" target="_blank">{{ pkg.name }}</a>
      <br />
      <span class="zi-tag success">{{ pkg.version }}</span>
    </h1>
  </header>
  <!-- <github-corners></github-corners> -->
  <ParsePreview />
</template>

<script setup lang="ts">
import pkg from '@advjs/parser/package.json'
</script>
