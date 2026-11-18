<script setup lang="ts">
defineProps<{
  index: string
  title: string
  /** Feature-status id, when the feature isn't finished */
  status?: string
}>()
</script>

<template>
  <article class="product-feature">
    <div class="p-text">
      <p class="index">
        {{ index }}
      </p>
      <h2 class="title">
        {{ title }}
        <FeatureStatus v-if="status" :id="status" link />
      </h2>
      <div class="body">
        <slot />
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.product-feature {
  position: relative;
  padding-top: 28px;
  border-top: 1px solid var(--vp-c-divider);

  & + & {
    margin-top: 56px;
  }
}

.vp-doc .index {
  margin: 0 0 6px;
  font-family: var(--p-system);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
  letter-spacing: 0.14em;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-brand-1);
}

.vp-doc .title {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: var(--p-story);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: 0.01em;

  &::before {
    display: none;
  }
}

.body {
  max-width: 34rem;
  margin-top: 10px;
  color: var(--vp-c-text-2);

  :deep(p) {
    margin: 0;
    font-size: 15px;
    line-height: 1.85;
  }

  :deep(p + p) {
    margin-top: 8px;
  }
}
</style>
