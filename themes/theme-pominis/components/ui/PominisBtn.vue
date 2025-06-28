<template>
  <button class="pominis-btn bg-image-$pominis-c-mix flex items-center justify-center rounded-xl px-10 py-5 text-white">
    <slot />
  </button>
</template>

<style lang="scss">
.pominis-btn {
  border-bottom: 5px solid rgba(0, 0, 0, 0.2);

  &:active {
    border-bottom-width: 0px;
  }
}
</style>
