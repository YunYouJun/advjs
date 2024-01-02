<script setup lang="ts">
import pkg from '../../../package.json'
</script>

<template>
  <header p="2">
    <h1 class="text-center">
      Demo for
      <a font="black" hover="underline" :href="pkg.readme" target="_blank">{{ pkg.name }}</a>
      <a
        class="border rounded text-xs text-white shadow"
        bg="gray-800"
        m="l-2"
        p="x-2 y-1"
        href="https://www.npmjs.com/package/@advjs/parser"
        target="_blank"
      >v{{ pkg.version }}</a>
    </h1>
  </header>
  <ParsePreview />
</template>
