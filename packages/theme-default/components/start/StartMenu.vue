<script setup lang="ts">
import type { StartMenuItem } from '@advjs/theme-default'

defineProps<{
  menuItems: StartMenuItem[]
}>()
</script>

<template>
  <ul class="start-menu absolute flex flex-col items-end">
    <li
      v-for="(item, i) in menuItems"
      :key="i"
      class="animate__animated animate__fadeInRight start-menu-item font-serif transition"
      :style="`animation-delay: ${0.4 + i * 0.1}s`"
      @click="item.do"
    >
      {{ item.title }}
    </li>
  </ul>
</template>

<style lang="scss">
@use 'sass:map';
.start-menu {
  font-size: 2rem;

  right: 3rem;
  bottom: 3rem;
}

.start-menu-item {
  cursor: pointer;
  font-weight: 900;
  background-color: rgba(255, 255, 255, 0.1);
  line-height: 1;

  margin: 0.5rem;
  padding: 0.5rem 1.25rem;

  transition: all 0.2s;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    color: white;
    box-shadow: 5px 5px 24px rgba(0, 0, 0, 0.3);
    background-color: rgba(0, 0, 0, 0.9);
  }
}
</style>
