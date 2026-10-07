<template>
  <button class="pominis-btn text-white px-10 py-5 rounded-xl flex bg-image-$pominis-c-mix items-center justify-center">
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
