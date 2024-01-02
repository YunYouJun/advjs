<template>
  <div
    class="agui-form"
  >
    <slot />
  </div>
</template>

<style lang="scss">
.agui-form {
  display: flex;
  flex-direction: column;

  color: var(--agui-c-text-1);
}
</style>
