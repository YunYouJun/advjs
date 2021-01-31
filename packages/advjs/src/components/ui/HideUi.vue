<template>
  <div
    class="adv-icon-button hide-ui-button"
    @click="$store.commit('toggleUi')"
  >
    <icon-font name="eye-close-line" color="white" size="3rem"></icon-font>
  </div>
</template>
