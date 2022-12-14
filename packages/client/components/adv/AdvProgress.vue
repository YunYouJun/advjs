<script lang="ts" setup>
defineProps<{
  /**
   * 百分比 0-1
   */
  percentage: number
}>()
</script>

<template>
  <div class="adv-progress-bar-track">
    <div class="adv-progress-bar-inner" :style="{ width: `${percentage * 100}%` }" />
  </div>
</template>

<style lang="scss">
.adv-progress-bar {
  &-track {
    display: flex;
    align-items: center;
    margin: 60px auto;
    width: 100%;
    height: 12px;
    border-radius: 8px;
    background-color: rgb(222, 228, 247);
    overflow: hidden;
  }

  &-inner {
    height: 100%;
    transition: all 0.6s cubic-bezier(0, 0.64, 0.36, 1);

    // background-color: var(--adv-c-primary);
    background-color: black;
    opacity: 0.9;
  }
}
</style>
