<template>
  <div class="hint">
    <b>Tips:</b><br>
    Right-click on empty space to add new nodes<br>
    Drag a connection from the end interface to remove it
  </div>
</template>

<style>
.hint {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 5;
  padding: 1rem;
  background: #0003;
  color: white;
  pointer-events: none;
}
</style>
