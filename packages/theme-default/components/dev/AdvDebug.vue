<script setup lang="ts">
import { ref, watch } from 'vue'

const el = ref<HTMLElement | null>(null)
const open = ref(false)

watch(open, (value) => {
  if (!value)
    el.value!.scrollTop = 0
})
</script>

<template>
  <div ref="el" class="debug" :class="{ open }">
    <AdvIconButton class="fixed bottom-5 right-5" @click="open = !open">
      <i-ri-bug-line color="white" />
    </AdvIconButton>
    <div v-show="open" p="2">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.debug {
  box-sizing: border-box;
  position: fixed;
  right: 8px;
  bottom: 8px;
  z-index: 9999;
  color: #eee;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.85);
  transition: all 0.15s ease;
}

.debug.open {
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  margin-top: 0;
  border-radius: 0;
  padding: 0 0;
  overflow: auto;
}

@media (min-width: 512px) {
  .debug.open {
    width: 512px;
  }
}

.debug.open:hover {
  background-color: rgba(0, 0, 0, 0.9);
}
</style>
