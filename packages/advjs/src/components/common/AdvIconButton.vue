<template>
  <div class="adv-icon-button">
    <AdvIcon>
      <slot></slot>
    </AdvIcon>
  </div>
</template>

<style lang="scss">
.adv-icon-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;

  border-radius: 50%;
  padding: 0.6rem;
  cursor: pointer;
  &:hover {
    background: rgba(123, 123, 123, 0.1);
  }
}
</style>
