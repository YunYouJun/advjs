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
  font-size: 4rem;

  right: 6rem;
  bottom: 6rem;
}

.start-menu-item {
  cursor: pointer;
  font-weight: 900;
  background-color: rgba(255, 255, 255, 0.1);
  line-height: 1;

  margin: 1rem;
  padding: 1rem 2.5rem;

  transition: all 0.2s;
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.1);

  &:hover {
    color: white;
    box-shadow: 10px 10px 48px rgba(0, 0, 0, 0.3);
    background-color: rgba(0, 0, 0, 0.9);
  }
}
</style>
