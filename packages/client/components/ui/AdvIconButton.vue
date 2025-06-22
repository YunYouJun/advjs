<script lang="ts" setup>
// icon button
</script>

<template>
  <div class="adv-icon-button">
    <AdvIcon>
      <slot />
    </AdvIcon>
  </div>
</template>

<style lang="scss">
.adv-icon-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;

  border-radius: 50%;
  padding: 1rem;
  cursor: pointer;

  transition: 0.2s;

  &:hover {
    background: rgba(123, 123, 123, 0.2);
  }
}
</style>
