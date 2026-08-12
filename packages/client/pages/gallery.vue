<template>
  <main class="adv-gallery-page">
    <RouterLink class="adv-gallery-page__back" to="/start">
      ← 返回标题
    </RouterLink>
    <AdvGallery />
  </main>
</template>

<route lang="yaml">
meta:
  layout: fullscreen
</route>

<style scoped>
.adv-gallery-page {
  min-height: 100%;
  overflow: auto;
  background: radial-gradient(circle at 75% 10%, rgb(29 63 105 / 32%), transparent 34%), #050812;
}

.adv-gallery-page__back {
  position: fixed;
  z-index: 2;
  top: 1rem;
  left: 1rem;
  color: #75ddeb;
  text-decoration: none;
}
</style>
