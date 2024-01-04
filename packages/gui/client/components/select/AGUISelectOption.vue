<script lang="ts" setup>
defineProps<{
  value: string
  icon?: string
  label?: string
}>()
</script>

<template>
  <button class="agui-option">
    <span v-if="icon" :style="{ backgroundImage: `var(--b-icon-${icon})` }" class="icon" />
    <span>{{ label ?? value }}</span>
  </button>
</template>

<style lang="scss">
.agui-option {
  font:
    12px system-ui,
    sans-serif;
  color: #dddddd;
  padding: 0 6px 0 6px;
  user-select: none;
  background: transparent;
  border: 0;
  border-radius: 3px;
  text-align: left;
  display: flex;
  width: 100%;
  align-items: center;

  gap: 4px;
  min-height: 18px;
  cursor: pointer;

  &:hover {
    background: #4772b3;
    color: #ffffff;
  }

  .icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    background: no-repeat center center;
    background-size: contain;
  }
}
</style>
