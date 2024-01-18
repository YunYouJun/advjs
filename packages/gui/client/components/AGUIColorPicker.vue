<template>
  <input class="agui-color-picker" type="color">
</template>

<style lang="scss">
.agui-color-picker {
  width: 100%;
  height: 16px;
  padding: 0;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-color: transparent;

  border: none;
  border-bottom: 2px solid white;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
}
</style>
