<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'gradient' | 'soft'
}>(), {
  name: '',
  src: '',
  size: 'md',
  variant: 'gradient',
})

const initial = computed(() => (props.name || '?').trim().charAt(0).toUpperCase())
</script>

<template>
  <span class="s-avatar" :class="[`s-avatar--${size}`, `s-avatar--${variant}`]">
    <img v-if="src" class="s-avatar__img" :src="src" :alt="name">
    <span v-else class="s-avatar__initial">{{ initial }}</span>
  </span>
</template>

<style scoped>
.s-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  font-weight: 700;
  color: #fff;
  user-select: none;
}

.s-avatar--gradient {
  background: var(--adv-gradient-primary);
}

.s-avatar--soft {
  background: var(--adv-primary-light);
  color: var(--adv-primary);
}

.s-avatar--sm {
  width: 32px;
  height: 32px;
  font-size: var(--adv-font-body-sm);
}

.s-avatar--md {
  width: 46px;
  height: 46px;
  font-size: var(--adv-font-subtitle);
}

.s-avatar--lg {
  width: 58px;
  height: 58px;
  font-size: var(--adv-font-title);
}

.s-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
