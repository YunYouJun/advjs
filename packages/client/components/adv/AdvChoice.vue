<script lang="ts" setup>
const options = [
  {
    label: '确定',
    value: 'ok',
  },
  {
    label: '取消',
    value: 'cancel',
  },
]
</script>

<template>
  <div
    class="adv-choice absolute justify-center items-center"
    flex="~ col"
    w="full"
    h="full"
    text="2xl"
    font="bold"
  >
    <ul class="adv-options-container">
      <li v-for="option, i in options" :key="i" class="adv-option">
        {{ option.label }}
      </li>
    </ul>
    <slot />
  </div>
</template>

<style lang="scss">
.adv-choice {
  .adv-options-container {
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    z-index: var(--adv-options-z, 5);
  }

  .adv-option {
    cursor: pointer;

    margin: 1rem;
    padding: 0.5rem;
    background-color: rgba(0, 0, 0, 0.8);

    width: 50%;
    border: 1px solid white;

    @apply shadow;

    &:hover {
      @apply shadow-lg;
    }
  }
}
</style>
