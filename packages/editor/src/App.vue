<template>
  <base-header></base-header>
  <div id="input-editor" class="editor"></div>
  <div id="output-editor" class="editor"></div>
</template>

<script>
import { init } from './index';
import BaseHeader from './components/BaseHeader.vue';
export default {
  components: {
    BaseHeader,
  },
  mounted() {
    init();
  },
};
</script>
