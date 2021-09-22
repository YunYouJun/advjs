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

<script>
import pkg from '@advjs/parser/package.json'
import GithubCorner from './components/GithubCorner.vue'
import ParsePreview from './components/ParsePreview.vue'

export default {
  name: 'App',
  components: {
    GithubCorner,
    ParsePreview,
  },
  setup() {
    return {
      pkg,
    }
  },
}
</script>

<style>
header h1 {
  text-align: center;
}
</style>
