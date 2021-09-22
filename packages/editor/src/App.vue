<template>
  <base-header></base-header>
  <div id="input-editor" class="editor"></div>
  <div id="output-editor" class="editor"></div>
</template>

<script>
import BaseHeader from './components/BaseHeader.vue'
import { init } from './index'
export default {
  components: {
    BaseHeader,
  },
  mounted() {
    init()
  },
}
</script>
