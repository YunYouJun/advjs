<template>
  <header p="2">
    <h1 class="text-center">
      Demo for
      <a font="black" hover="underline" :href="pkg.homepage" target="_blank">{{ pkg.name }}</a>
      <a
        class="border rounded shadow text-white text-xs"
        bg="gray-800"
        m="l-2"
        p="x-2 y-1"
        href="https://www.npmjs.com/package/@advjs/parser"
        target="_blank"
      >v{{ pkg.version }}</a>
    </h1>
  </header>
  <github-corners repo="YunYouJun/advjs/tree/main/packages/parser" blank :reverse="isDark"></github-corners>
  <ParsePreview />
</template>

<script setup lang="ts">
import { getScript } from '@advjs/shared'
import { isClient } from '@vueuse/core'
import { isDark } from '@advjs/editor/composables'
import pkg from '@advjs/parser/../package.json'

if (isClient)
  getScript('https://cdn.jsdelivr.net/npm/wc-github-corners@latest')
</script>
