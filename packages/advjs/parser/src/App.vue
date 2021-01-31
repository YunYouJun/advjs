<template>
  <header>
    <h1>
      Demo for
      <a href="https://github.com/advjs/parser" target="_blank"
        >@advjs/parser</a
      >
    </h1>
  </header>
  <GithubCorner />
  <parse-preview />
</template>

<script>
import GithubCorner from './components/GithubCorner.vue';
import ParsePreview from './components/ParsePreview.vue';

export default {
  name: 'App',
  components: {
    GithubCorner,
    ParsePreview,
  },
};
</script>

<style>
header h1 {
  text-align: center;
}
</style>
