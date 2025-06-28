<script setup lang="ts">
import type { AdvStartMenuItem } from '@advjs/client'

defineProps<{
  menuItems: AdvStartMenuItem[]
}>()
</script>

<template>
  <ul class="start-menu absolute flex flex-col items-end gap-6">
    <PominisBtn
      v-for="(item, i) in menuItems"
      :key="i"
      class="animate__animated animate__fadeInRight start-menu-item min-w-500px gap-3 text-4xl font-sans transition"
      :style="`animation-delay: ${0.4 + i * 0.1}s`"
      @click="item.do"
    >
      <div v-if="item.icon" :class="item.icon" />
      <span>
        {{ item.title }}
      </span>
    </PominisBtn>
  </ul>
</template>

<style lang="scss">
@use 'sass:map';
.start-menu {
  right: 6rem;
  bottom: 6rem;
}

.start-menu-item {
  cursor: pointer;
  font-weight: 900;
  line-height: 1;

  padding: 1.25rem 2.5rem;

  transition: all 0.2s;
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.1);

  &:hover {
    color: white;
    box-shadow: 10px 10px 48px rgba(0, 0, 0, 0.3);
    background-color: rgba(0, 0, 0, 0.9);
  }
}
</style>
