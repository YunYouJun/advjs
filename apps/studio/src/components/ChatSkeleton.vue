<script setup lang="ts">
defineProps<{
  /** Number of skeleton message rows to render (default 5) */
  count?: number
}>()
</script>

<template>
  <div class="chat-skeleton" aria-hidden="true">
    <div
      v-for="i in (count ?? 5)"
      :key="i"
      class="chat-skeleton__row"
      :class="i % 3 === 1 ? 'chat-skeleton__row--right' : 'chat-skeleton__row--left'"
    >
      <div
        class="chat-skeleton__bubble"
        :style="{ animationDelay: `${(i - 1) * 120}ms`, width: `${40 + ((i * 17) % 35)}%` }"
      >
        <div class="chat-skeleton__line chat-skeleton__line--full" />
        <div v-if="i % 2 === 0" class="chat-skeleton__line chat-skeleton__line--half" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  min-height: 200px;
}

.chat-skeleton__row {
  display: flex;
}

.chat-skeleton__row--left {
  justify-content: flex-start;
}

.chat-skeleton__row--right {
  justify-content: flex-end;
}

.chat-skeleton__bubble {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  min-height: 36px;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.chat-skeleton__row--left .chat-skeleton__bubble {
  background: var(--adv-surface-elevated, #f0f0f5);
  border-bottom-left-radius: 4px;
}

.chat-skeleton__row--right .chat-skeleton__bubble {
  background: rgba(139, 92, 246, 0.1);
  border-bottom-right-radius: 4px;
}

.chat-skeleton__line {
  height: 10px;
  border-radius: 5px;
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
}

.chat-skeleton__line--full {
  width: 100%;
}

.chat-skeleton__line--half {
  width: 60%;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-skeleton__bubble {
    animation: none;
  }
}

/* Dark mode adjustments */
:root.dark .chat-skeleton__row--left .chat-skeleton__bubble {
  background: var(--adv-surface-elevated, #1e1e2e);
}

:root.dark .chat-skeleton__row--right .chat-skeleton__bubble {
  background: rgba(139, 92, 246, 0.15);
}

:root.dark .chat-skeleton__line {
  background: rgba(255, 255, 255, 0.08);
}
</style>
