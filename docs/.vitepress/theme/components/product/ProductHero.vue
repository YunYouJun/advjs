<script setup lang="ts">
// Hero for a product page. The page's own Markdown H1 is the product name;
// this component adds the line under it and the ways to open the product.
defineProps<{
  /** Where the reader is when they use it, in the home page's words: 【电脑前】 */
  where: string
  platforms: string
  title: string
  lead: string
  /** Feature-status id for the product as a whole */
  status?: string
}>()
</script>

<template>
  <section class="product-hero">
    <p class="hud">
      <span class="p-where">{{ where }}</span>
      <span>{{ platforms }}</span>
      <FeatureStatus v-if="status" :id="status" link />
    </p>
    <p class="title">
      {{ title }}
    </p>
    <p class="lead">
      {{ lead }}
    </p>
    <div class="actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style lang="scss">
// Shared by every product page: tokens, and the Markdown H1 restyled as the product name.
.adv-product-page {
  --p-story: var(--adv-font-story);
  --p-system: var(--adv-font-system);
  --p-mono: var(--vp-font-family-mono);
  --p-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --p-lamp: #b86e00;

  .dark & {
    --p-lamp: #ffc46b;
  }

  .vp-doc h1 {
    font-family: var(--p-story);
    font-size: clamp(34px, 6vw, 44px);
    font-weight: 900;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .features {
    margin-top: 48px;
  }

  // Where the product section ends and the reference text begins
  .vp-doc .reference-mark {
    display: flex;
    gap: 14px;
    align-items: center;
    margin: 80px 0 0;
    font-family: var(--p-system);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.14em;
    color: var(--vp-c-text-3);

    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--vp-c-divider);
    }
  }
}
</style>

<style scoped lang="scss">
.product-hero {
  margin: 12px 0 0;
}

.hud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  margin: 0 0 18px;
  font-family: var(--p-system);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
  letter-spacing: 0.14em;
  color: var(--vp-c-text-2);
}

.p-where {
  color: var(--vp-c-brand-1);
  letter-spacing: 0.04em;
}

.vp-doc .title {
  margin: 0;
  font-family: var(--p-story);
  font-size: clamp(22px, 3.4vw, 28px);
  font-weight: 700;
  line-height: 1.45;
  color: var(--vp-c-text-1);
  text-wrap: balance;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.vp-doc .lead {
  margin: 14px 0 0;
  max-width: 36rem;
  font-size: 16px;
  line-height: 1.85;
  color: var(--vp-c-text-2);
  text-wrap: pretty;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
  align-items: flex-start;
  margin-top: 28px;
}
</style>
