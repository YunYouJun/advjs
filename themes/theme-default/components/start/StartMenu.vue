<script setup lang="ts">
import type { StartMenuItem } from '@advjs/theme-default'

defineProps<{
  menuItems: StartMenuItem[]
}>()
</script>

<template>
  <ul class="start-menu absolute flex flex-col items-end gap-9">
    <li v-for="(item, i) in menuItems" :key="i">
      <button
        type="button"
        class="animate__animated animate__fadeInRight start-menu-item flex gap-3 text-6xl adv-font-serif transition"
        :style="`animation-delay: ${0.4 + i * 0.1}s`"
        @click="item.do"
      >
        <span v-if="item.icon" :class="item.icon" aria-hidden="true" />
        <span>{{ item.title }}</span>
      </button>
    </li>
  </ul>
</template>

<style lang="scss">
.start-menu {
  right: 6rem;
  bottom: 6rem;
}

.start-menu-item {
  cursor: pointer;
  border: 0;
  color: inherit;
  font-weight: 900;
  background-color: var(--adv-theme-start-menu-bg, rgb(255 255 255 / 10%));
  line-height: 1;

  padding: 1.25rem 2.5rem;

  transition: all 0.2s;
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.1);

  &:hover {
    color: var(--adv-theme-start-menu-hover-color, white);
    box-shadow: 10px 10px 48px rgba(0, 0, 0, 0.3);
    background-color: var(--adv-theme-start-menu-hover-bg, rgb(0 0 0 / 90%));
  }
}
</style>
