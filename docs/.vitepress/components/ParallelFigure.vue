<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, reactive, ref } from 'vue'
// import { useData } from 'vitepress'

import { useParallax } from '@vueuse/core'

const target = ref(document && document.body)
const parallax = reactive(useParallax(target))

// const { site, frontmatter } = useData()
// const heroText = computed(() => frontmatter.value.heroText || site.value.title)

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '350px',
  transition: '.3s ease-out all',

  perspective: '300px',
}

const cardStyle = computed(() => ({
  height: '20rem',
  width: '15rem',
  borderRadius: '5px',
  transition: '.3s ease-out all',
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
  <div ref="target" m="t-16" :style="containerStyle">
    <div :style="cardStyle">
      <figure class="figure" :style="layer0">
        <svg
          class="w-50 h-50 m-auto"
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

      <!-- <h1
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
      </h1> -->
    </div>
  </div>
</template>
