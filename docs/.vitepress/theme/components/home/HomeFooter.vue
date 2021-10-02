<script setup lang="ts">
import { useData } from 'vitepress'

const { frontmatter } = useData()
</script>

<template>
  <footer v-if="frontmatter.footer" class="footer">
    <div class="container text">
      <a v-if="frontmatter.footer.license" href="https://github.com/YunYouJun/advjs/blob/main/LICENSE" target="_blank"><span>{{ frontmatter.footer.license }}</span></a>
      <span class="mx-2">Copyright © {{frontmatter.footer.since + ' - ' + new Date().getFullYear()}}</span>
      <a v-if="frontmatter.footer.author" href="https://yunyoujun.cn/" target="_blank" v-html="frontmatter.footer.author"></a>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  margin: 0 auto;
  max-width: 960px;
}

@media (min-width: 720px) {
  .footer {
    padding: 0 1.5rem;
  }
}

.container {
  padding: 2rem 1.5rem 2.25rem;
}

.home-hero + .footer .container,
.home-features + .footer .container,
.home-content + .footer .container {
  border-top: 1px solid var(--c-divider);
}

@media (min-width: 420px) {
  .container {
    padding: 1.5rem;
  }
}

.text {
  margin: 0;
  text-align: center;
  line-height: 1.4;
  font-size: 0.9rem;
  color: var(--c-text-light);
}
</style>
