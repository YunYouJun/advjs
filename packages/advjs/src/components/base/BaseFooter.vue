<template>
  <vue-about-me :is-dark="isDark" :copyright="copyright"></vue-about-me>
</template>

<script setup lang="ts">
import VueAboutMe from 'vue-about-me'
import pkg from '~/../package.json'
import { isDark } from '~/composables'

import 'vue-about-me/style.css'

const copyright = {
  name: 'ADV.JS',
  repo: pkg.name,
  author: pkg.author.name,
}
</script>
