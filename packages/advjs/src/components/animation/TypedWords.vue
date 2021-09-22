<template>
  <div class="typed-words"></div>
</template>

<script>
import Typed from 'typed.js'
export default {
  props: {
    words: {
      type: String,
      default: '',
    },
    typeSpeed: {
      type: Number,
      default: 20,
    },
  },
  data() {
    return {
      typedObj: null,
    }
  },
  watch: {
    words() {
      if (this.typedObj)
        this.typedObj.destroy()

      this.initTypedJs()
    },
  },
  methods: {
    initTypedJs() {
      this.typedObj = new Typed('.typed-words', {
        strings: [this.words],
        typeSpeed: this.typeSpeed,
        cursorChar: '▼',
      })
    },
  },
}
</script>

<style>
.typed-cursor {
  position: absolute;
  right: 3rem;
  bottom: 1.5rem;
}
</style>
