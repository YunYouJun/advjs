<script setup lang="ts">
import { computed, CSSProperties, reactive } from 'vue'
import { useData, withBase } from 'vitepress'
// import NavLink from 'vitepress/dist/client/theme-default/components/NavLink.vue'
import PressButton from 'advjs/client/app/components/global/PressButton.vue'
import { ParallaxReturn } from '@vueuse/core'

const { site, frontmatter } = useData()

const showHero = computed(() => {
  const { heroImage, heroText, tagline, actionLink, actionText }
    = frontmatter.value
  return heroImage || heroText || tagline || (actionLink && actionText)
})

const heroText = computed(() => frontmatter.value.heroText || site.value.title)
const tagline = computed(
  () => frontmatter.value.tagline || site.value.description,
)

// const { theme } = useData()
// const badgeUrl = computed(
//   () => `https://img.shields.io/github/stars/${theme.value.repo}?style=social`,
// )

const props = defineProps<{
  parallax: ParallaxReturn
}>()
const parallax = reactive(props.parallax)

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '400px',
  transition: '.3s ease-out all',

  perspective: '300px',
}

const cardStyle = computed(() => ({
  background: '#fff',
  height: '20rem',
  width: '15rem',
  borderRadius: '5px',
  transition: '.3s ease-out all',
  boxShadow: '0 0 20px 0 rgba(255, 255, 255, 0.25)',
  transform: `rotateX(${parallax.roll * 20}deg) rotateY(${
    parallax.tilt * 20
  }deg)`,
}))

const layerBase: CSSProperties = {
  position: 'absolute',
  width: '100%',
  transition: '.3s ease-out all',
}

const layer0 = computed(() => ({
  ...layerBase,
  transform: `translateX(${parallax.tilt * 10}px) translateY(${
    parallax.roll * 10
  }px) scale(1.33)`,
}))

const layer1 = computed(() => ({
  ...layerBase,
  marginTop: '16rem',
  transform: `translateX(${parallax.tilt}px) translateY(${parallax.roll}px) scale(1.33)`,
}))

const startColor = computed(
  () =>
    `rgb(34, ${Math.floor(211 - parallax.tilt * 100)}, ${Math.floor(
      238 - parallax.roll * 10,
    )})`,
)
const endColor = computed(
  () =>
    `rgb(37, ${Math.floor(99 - parallax.tilt * 100)}, ${Math.floor(
      238 - parallax.roll * 10,
    )})`,
)
</script>

<template>
  <header v-if="showHero" class="home-hero text-center">
    <div :style="containerStyle">
      <div :style="cardStyle">
        <figure v-if="frontmatter.heroImage" class="figure" :style="layer0">
          <!-- <img
            class="image"
            :src="withBase(frontmatter.heroImage)"
            :alt="frontmatter.heroAlt"
            style="drop-shadow: 5px 5px black"
          /> -->
          <svg
            class="image"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
          >
            <defs>
              <linearGradient id="shape-gradient" x2="0.35" y2="1">
                <stop offset="0%" :stop-color="startColor" />
                <stop offset="100%" :stop-color="endColor" />
              </linearGradient>
            </defs>
            <path fill="none" d="M0 0h24v24H0z" />
            <path
              d="M14 10.25L17 8v6l-3-2.25V14H7V8h7v2.25zM5.763
            17H20V5H4v13.385L5.763 17zm.692 2L2 22.5V4a1 1 0 0 1 1-1h18a1 1 0 0
            1 1 1v14a1 1 0 0 1-1 1H6.455z"
              fill="url(#shape-gradient)"
            />
          </svg>
        </figure>

        <h1
          v-if="heroText"
          id="main-title"
          class="title font-thin"
          :style="layer1"
        >
          <b
            class="
              font-serif
              gradient-text
              from-cyan-400
              to-blue-600
              bg-gradient-to-r
            "
          >ADV</b>
          <span>.JS</span>
        </h1>
      </div>
    </div>

    <template v-if="tagline">
      <template v-if="typeof tagline === 'string'">
        <p
          class="
            tagline
            gradient-text
            from-blue-600
            to-red-500
            bg-gradient-to-r
            font-light
          "
        >
          {{ tagline }}
        </p>
      </template>
      <template v-else>
        <p v-for="line in tagline" class="tagline">
          {{ line }}
        </p>
      </template>
    </template>

    <!-- <NavLink
      v-if="frontmatter.actionLink && frontmatter.actionText"
      :item="{ link: frontmatter.actionLink, text: frontmatter.actionText }"
      class="action mx-2"
    />

    <NavLink
      v-if="frontmatter.altActionLink && frontmatter.altActionText"
      :item="{
        link: frontmatter.altActionLink,
        text: frontmatter.altActionText,
      }"
      class="action alt mx-2"
    /> -->

    <div class="flex justify-center mt-8">
      <PressButton
        v-if="frontmatter.actionLink && frontmatter.actionText"
        :link="frontmatter.actionLink"
        class="
          mx-2
          !bg-gray-700
          !hover:bg-gray-500
          !border-dark-900
          !hover:border-dark-500
        "
        blank
      >
        <i-ri-github-line class="text-white mr-1" />
        {{ frontmatter.actionText }}
      </PressButton>

      <PressButton
        v-if="frontmatter.altActionLink && frontmatter.altActionText"
        :link="frontmatter.altActionLink"
        class="
          mx-2
          !bg-green-500
          !hover:bg-green-400
          !border-green-600
          !hover:border-green-500
        "
        blank
      >
        <i-ri-game-line class="text-white mr-1" />
        {{ frontmatter.altActionText }}
      </PressButton>
    </div>

    <br />

    <PressButton class="mx-2" :link="frontmatter.startLink">
      <i-ri-links-line class="text-white mr-1" />
      Link Start
    </PressButton>
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
  padding: 0.2rem 1.5rem;
  line-height: 2.5rem;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--c-bg);
  background-color: var(--c-brand);
  border: 1px solid var(--c-brand);
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
