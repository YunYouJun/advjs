<template>
  <svg
    class="icon"
    aria-hidden="true"
    :style="{ color: color, fontSize: size }"
  >
    <use :xlink:href="`#icon-${name}`"></use>
  </svg>
</template>

<script lang="ts">
export default {
  props: {
    name: {
      type: String,
      default: 'checkbox-blank-circle-line',
    },
    color: {
      type: String,
      default: 'white',
    },
    size: {
      type: String,
      default: '3rem',
    },
  },
};
</script>

<style>
.icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
}
</style>
