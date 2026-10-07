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
  padding: calc(12px / var(--adv-screen-scale, 1));
}

.save-slots-grid {
  display: grid;
  width: 100%;
  height: 100%;
  margin: 0 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(calc(88px / var(--adv-screen-scale, 1)), 1fr);
  gap: calc(10px / var(--adv-screen-scale, 1));
}

@container adv-game (min-width: 960px) {
  .save-slots-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container adv-game (max-width: 599px) {
  .save-slots-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: minmax(132px, 1fr);
  }
}
</style>
