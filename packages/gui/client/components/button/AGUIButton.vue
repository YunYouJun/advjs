<template>
  <button class="agui-button">
    <slot />
  </button>
</template>

<style lang="scss">
.agui-button {
  --border-radius: 2px;
}

.agui-button {
  display: inline-flex;
  font-size: 9px;

  appearance: none;
  background: rgba(88, 88, 88, 1) no-repeat center center;
  color: #e6e6e6;
  padding-inline: 8px;
  flex-shrink: 0;
  cursor: pointer;

  border-radius: var(--border-radius);
  box-shadow: 0 1px 1px rgba(black, 0.3);

  &[data-location='ALONE'] {
    border-radius: var(--border-radius);
  }
  &[data-location='LEFT'] {
    border-top-left-radius: var(--border-radius) var(--border-radius);
    border-bottom-left-radius: var(--border-radius) var(--border-radius);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  &[data-location='RIGHT'] {
    border-top-right-radius: var(--border-radius) var(--border-radius);
    border-bottom-right-radius: var(--border-radius) var(--border-radius);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  &:hover {
    background: rgba(100, 100, 100, 1);
    color: #ffffff;
  }
  &.pressed,
  &:active {
    background-color: #4772b3;
    color: #ffffff;
  }
}
</style>
