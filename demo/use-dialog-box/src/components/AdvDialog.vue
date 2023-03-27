<script setup lang="ts">
import { onMounted, ref } from 'vue'

const mdText = ref('')
const advDialog = ref()

onMounted(async () => {
  mdText.value = await fetch('/main.md').then(res => res.text())
})
</script>

<template>
  <textarea v-model="mdText" class="demo-textarea" w="full" />
  <div ref="advDialog" class="demo-adv-dialog">
    TODO
  </div>
</template>

<style>
.demo-textarea {
  height: calc(100vh - 350px);
}

.demo-adv-dialog {
  color: white;
  padding: 1rem;
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 300px;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 999;
}
</style>
