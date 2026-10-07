<script setup lang="ts">
import type { StartMenuItem } from '@advjs/theme-default'

withDefaults(defineProps<{ menuItems: StartMenuItem[], inline?: boolean }>(), { inline: false })
</script>

<template>
  <ul class="start-menu" :class="{ 'start-menu-inline': inline }">
    <li v-for="item in menuItems" :key="item.id">
      <button type="button" class="start-menu-item" :data-action="item.id" @click="item.do">
        <span v-if="item.icon" class="start-menu-icon" :class="item.icon" aria-hidden="true" />
        <span class="start-menu-label">{{ item.title }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped lang="scss">
@use '@advjs/client/styles/control-button.scss' as controls;

.start-menu {
  position: absolute;
  right: calc(28px / var(--adv-screen-scale, 1));
  bottom: calc(28px / var(--adv-screen-scale, 1));
  display: flex;
  flex-direction: column;
  gap: calc(8px / var(--adv-screen-scale, 1));
  margin: 0;
  padding: 0;
  list-style: none;
  width: min(calc(300px / var(--adv-screen-scale, 1)), calc(100% - 56px / var(--adv-screen-scale, 1)));
}
.start-menu-inline {
  position: static;
  width: 100%;
}
.start-menu-item {
  @include controls.feedback(
    var(--adv-theme-start-menu-hover-bg, color-mix(in srgb, var(--adv-c-primary) 12%, var(--adv-c-bg-alt))),
    var(--adv-theme-start-menu-hover-bg, color-mix(in srgb, var(--adv-c-primary) 20%, var(--adv-c-bg-alt)))
  );
  display: flex;
  align-items: center;
  gap: calc(12px / var(--adv-screen-scale, 1));
  width: 100%;
  min-height: calc(44px / var(--adv-screen-scale, 1));
  padding: calc(12px / var(--adv-screen-scale, 1)) calc(16px / var(--adv-screen-scale, 1));
  color: var(--adv-theme-start-menu-color, var(--adv-c-text));
  background: var(--adv-theme-start-menu-bg, color-mix(in srgb, var(--adv-c-bg-alt) 78%, transparent));
  font-family: var(--adv-font-family, system-ui), sans-serif;
  font-size: calc(var(--adv-theme-start-menu-size, 18px) / var(--adv-screen-scale, 1));
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  overflow-wrap: anywhere;

  &[data-action='start_game'] {
    border-color: color-mix(in srgb, var(--adv-c-primary) 45%, transparent);
    font-weight: 600;
  }
  &:hover {
    color: var(--adv-theme-start-menu-hover-color, var(--adv-c-text));
  }
}
.start-menu-icon {
  flex: none;
  font-size: calc(20px / var(--adv-screen-scale, 1));
}
.start-menu-label {
  min-width: 0;
}
</style>
