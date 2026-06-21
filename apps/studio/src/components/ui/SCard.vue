<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'hero' | 'surface'
  padding?: 'sm' | 'md' | 'lg'
  interactive?: boolean
}>(), {
  variant: 'default',
  padding: 'md',
  interactive: false,
})
</script>

<template>
  <div
    class="s-card"
    :class="[
      `s-card--${variant}`,
      `s-card--pad-${padding}`,
      interactive && 's-card--interactive',
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.s-card {
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 0.5px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  color: var(--adv-text-primary);
}

.s-card--pad-sm {
  padding: var(--adv-space-sm);
}
.s-card--pad-md {
  padding: var(--adv-space-md);
}
.s-card--pad-lg {
  padding: var(--adv-space-lg);
}

/* ── Surface: subtle brand-tinted card ── */
.s-card--surface {
  background: var(--adv-gradient-surface);
}

/* ── Hero: epic gradient, white text (品牌主卡) ── */
.s-card--hero {
  background: var(--adv-gradient-epic);
  color: #fff;
  border: none;
  box-shadow: var(--adv-shadow-glow);
}

/* ── Interactive: press feedback ── */
.s-card--interactive {
  cursor: pointer;
  transition:
    transform var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
}

.s-card--interactive:active {
  transform: scale(0.98);
}
</style>
