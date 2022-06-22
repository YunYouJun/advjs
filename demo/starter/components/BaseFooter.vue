<script setup lang="ts">
import VueAboutMe from 'vue-about-me'
import { isDark } from '@advjs/client/composables'
import pkg from '~/../package.json'

import 'vue-about-me/style.css'

const copyright = {
  name: 'ADV.JS',
  repo: pkg.name,
  author: pkg.author.name,
}
</script>

<template>
  <vue-about-me :is-dark="isDark" :copyright="copyright" />
</template>
