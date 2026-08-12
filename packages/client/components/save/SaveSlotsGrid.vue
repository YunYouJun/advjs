<template>
  <div class="save-slots-scroll">
    <div class="save-slots-grid">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.save-slots-scroll {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  scrollbar-gutter: stable;
}

.save-slots-grid {
  display: grid;
  width: 100%;
  max-width: 88rem;
  margin: 0 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: clamp(0.65rem, 1.5vw, 1.1rem);
}

@media (max-width: 800px) {
  .save-slots-scroll {
    padding: 0.75rem;
  }

  .save-slots-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
