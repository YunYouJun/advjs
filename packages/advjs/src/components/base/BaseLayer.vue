<template>
  <div class="hide-ui-layer" @click="$store.commit('toggleUi')"></div>
</template>

<style>
.hide-ui-layer {
  z-index: 9999;
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
}
</style>
