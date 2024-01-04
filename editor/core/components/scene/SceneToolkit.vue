<script lang="ts" setup>
const containerRef = ref<HTMLElement | null>(null)

// `style` will be a helper computed for `left: ?px; top: ?px;`
const { x: _x, y: _y, style } = useDraggable(containerRef, {
  initialValue: { x: 40, y: 40 },
})

// use draggable can not absolute
</script>

<template>
  <div
    ref="containerRef" :style="style"
    class="fixed cursor-move select-none"
    touch-none
  >
    <AGUIIconButton icon="i-ri-brush-line" />
  </div>
</template>
