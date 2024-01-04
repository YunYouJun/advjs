<template>
  <button class="agui-button">
    <slot />
  </button>
</template>

<style lang="scss">
.agui-button {
  font-size: 12px;

  appearance: none;
  background: #545454 no-repeat center center;
  color: #e6e6e6;
  border: 1px solid #3d3d3d;
  padding-inline: 8px;
  flex-shrink: 0;
  cursor: pointer;

  &[data-location='ALONE'] {
    border-radius: 2px / 3px;
  }
  &[data-location='LEFT'] {
    border-top-left-radius: 2px 3px;
    border-bottom-left-radius: 2px 3px;
  }
  &[data-location='RIGHT'] {
    border-top-right-radius: 2px 3px;
    border-bottom-right-radius: 2px 3px;
  }

  &:hover {
    background: #656565;
    color: #ffffff;
  }
  &.pressed,
  &:active {
    background-color: #4772b3;
    color: #ffffff;
  }
}
</style>
