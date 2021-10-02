<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import NavLink from 'vitepress/dist/client/theme-default/components/NavLink.vue'

const { site, frontmatter, theme } = useData()

const showHero = computed(() => {
  const { heroImage, heroText, tagline, actionLink, actionText } =
    frontmatter.value
  return heroImage || heroText || tagline || (actionLink && actionText)
})

const heroText = computed(() => frontmatter.value.heroText || site.value.title)
const tagline = computed(
  () => frontmatter.value.tagline || site.value.description
)

const badgeUrl = computed(() => `https://img.shields.io/github/stars/${theme.value.repo}?style=social`)
</script>

<template>
  <header v-if="showHero" class="home-hero text-center">
    <figure v-if="frontmatter.heroImage" class="figure">
      <img
        class="image"
        :src="withBase(frontmatter.heroImage)"
        :alt="frontmatter.heroAlt"
      />
    </figure>

    <h1 v-if="heroText" id="main-title" class="title" v-html="heroText"></h1>
    <template v-if="tagline">
      <template v-if="typeof tagline === 'string'">
        <p class="tagline">{{ tagline }}</p>
      </template>
      <template v-else>
        <p v-for="line in tagline" class="tagline">{{line}}</p>
      </template>
    </template>

    <NavLink
      v-if="frontmatter.actionLink && frontmatter.actionText"
      :item="{ link: frontmatter.actionLink, text: frontmatter.actionText }"
      class="action mx-2"
    />

    <NavLink
      v-if="frontmatter.altActionLink && frontmatter.altActionText"
      :item="{
        link: frontmatter.altActionLink,
        text: frontmatter.altActionText
      }"
      class="action alt mx-2"
    />
  </header>
</template>

<style scoped>
.home-hero {
  margin: 2rem 0 2.25rem;
  padding: 0 1.5rem;
  text-align: center;
}

@media (min-width: 420px) {
  .home-hero {
    margin: 3rem 0;
  }
}

@media (min-width: 720px) {
  .home-hero {
    margin: 2rem 0 2rem;
  }
}

.figure {
  padding: 0 1.5rem;
}

.image {
  display: block;
  margin: 0 auto;
  width: auto;
  max-width: 100%;
  max-height: 280px;
}

.title {
  margin-top: 1.5rem;
  font-size: 2rem;
}

@media (min-width: 420px) {
  .title {
    font-size: 3rem;
  }
}

@media (min-width: 720px) {
  .title {
    margin-top: 2rem;
  }
}

.tagline {
  margin: 0;
  margin-top: 1rem;
  line-height: 1.3;
  font-size: 1.1rem;
  color: var(--c-text-light);
}

@media (min-width: 420px) {
  .tagline {
    line-height: 1.2;
    font-size: 1.6rem;
  }
}

.action {
  margin-top: 1.5rem;
  display: inline-block;
}

@media (min-width: 420px) {
  .action {
    margin-top: 2rem;
    display: inline-block;
  }
}

.action :deep(.item) {
  display: inline-block;
  border-radius: 2rem;
  padding: 0 1.5rem;
  line-height: 2.5rem;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--c-bg);
  background-color: var(--c-brand);
  border: 2px solid var(--c-brand);
  transition: background-color 0.1s ease;
}

.action.alt :deep(.item) {
  background-color: var(--c-bg);
  color: var(--c-brand);
}

.action :deep(.item:hover) {
  text-decoration: none;
  color: var(--c-bg);
  background-color: var(--c-brand-light);
}
</style>
