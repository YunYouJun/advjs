<script setup lang="ts">
</script>

<template>
  <div class="world-skeleton" aria-hidden="true">
    <!-- Clock bar skeleton -->
    <div class="world-skeleton__clock">
      <div class="world-skeleton__bar world-skeleton__bar--sm" />
      <div class="world-skeleton__bar world-skeleton__bar--xs" />
    </div>

    <!-- Character cards skeleton -->
    <div class="world-skeleton__section">
      <div class="world-skeleton__bar world-skeleton__bar--title" />
      <div class="world-skeleton__cards">
        <div v-for="i in 3" :key="i" class="world-skeleton__card" :style="{ animationDelay: `${(i - 1) * 150}ms` }">
          <div class="world-skeleton__avatar" />
          <div class="world-skeleton__card-body">
            <div class="world-skeleton__bar world-skeleton__bar--md" />
            <div class="world-skeleton__bar world-skeleton__bar--lg" />
          </div>
        </div>
      </div>
    </div>

    <!-- Events skeleton -->
    <div class="world-skeleton__section">
      <div class="world-skeleton__bar world-skeleton__bar--title" />
      <div v-for="i in 2" :key="`e${i}`" class="world-skeleton__event" :style="{ animationDelay: `${450 + (i - 1) * 150}ms` }">
        <div class="world-skeleton__bar world-skeleton__bar--lg" />
        <div class="world-skeleton__bar world-skeleton__bar--md" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-skeleton {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: var(--adv-space-md, 16px);
}

.world-skeleton__clock {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--adv-radius-lg, 14px);
  background: var(--adv-surface-card, #f8f9fa);
  animation: world-skeleton-pulse 1.6s ease-in-out infinite;
}

.world-skeleton__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.world-skeleton__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.world-skeleton__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--adv-radius-lg, 14px);
  background: var(--adv-surface-card, #f8f9fa);
  animation: world-skeleton-pulse 1.6s ease-in-out infinite;
}

.world-skeleton__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  flex-shrink: 0;
}

.world-skeleton__card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.world-skeleton__event {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border-radius: var(--adv-radius-md, 8px);
  background: var(--adv-surface-card, #f8f9fa);
  animation: world-skeleton-pulse 1.6s ease-in-out infinite;
}

.world-skeleton__bar {
  height: 10px;
  border-radius: 5px;
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
}

.world-skeleton__bar--xs {
  width: 40px;
}
.world-skeleton__bar--sm {
  width: 80px;
}
.world-skeleton__bar--md {
  width: 50%;
}
.world-skeleton__bar--lg {
  width: 75%;
}
.world-skeleton__bar--title {
  width: 100px;
  height: 12px;
  margin-bottom: 4px;
}

@keyframes world-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .world-skeleton__card,
  .world-skeleton__clock,
  .world-skeleton__event {
    animation: none;
  }
}

/* Dark mode */
:root.dark .world-skeleton__clock,
:root.dark .world-skeleton__card,
:root.dark .world-skeleton__event {
  background: var(--adv-surface-card, #1e1e2e);
}

:root.dark .world-skeleton__bar,
:root.dark .world-skeleton__avatar {
  background: rgba(255, 255, 255, 0.08);
}
</style>
