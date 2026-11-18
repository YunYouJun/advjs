<script setup lang="ts">
import { useExtrasI18n } from '../composables/useExtrasI18n'

const { t } = useExtrasI18n()
</script>

<template>
  <div class="adv-extras-page">
    <RouterLink class="adv-extras-page__back" to="/start">
      {{ t('extras.back') }}
    </RouterLink>
    <AdvExtras />
  </div>
</template>

<route lang="yaml">
meta:
  layout: fullscreen
</route>

<style scoped>
.adv-extras-page {
  height: 100%;
  overflow: auto;
  background: var(
    --adv-theme-extras-background,
    radial-gradient(circle at 75% 10%, rgb(29 63 105 / 32%), transparent 34%),
    #050812
  );
}

.adv-extras-page__back {
  position: fixed;
  z-index: 2;
  top: 1rem;
  left: 1rem;
  color: var(--adv-theme-extras-accent, #75ddeb);
  text-decoration: none;
}
</style>
