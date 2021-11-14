<template>
  <header p="2">
    <h1 class="text-center">
      Demo for
      <a font="black" hover="underline" :href="pkg.homepage" target="_blank">{{ pkg.name }}</a>
      <span
        class="border rounded shadow"
        bg="gray-800"
        text="white xs"
        m="l-2"
        p="x-2 y-1"
      >v{{ pkg.version }}</span>
    </h1>
  </header>
  <github-corners></github-corners>
  <ParsePreview />
</template>

<script setup lang="ts">
import pkg from '~/../../parser/package.json'
</script>
