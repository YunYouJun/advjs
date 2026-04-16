<!--
  General-purpose skeleton loading component.
  Prebuilt for future use — not yet imported by any page.
  Use it in any tab page that needs a loading placeholder.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  /** Number of skeleton list items to show */
  lines?: number
  /** Show a header bar skeleton */
  showHeader?: boolean
  /** Show action button skeletons */
  showActions?: boolean
}>(), {
  lines: 5,
  showHeader: true,
  showActions: false,
})
</script>

<template>
  <div class="app-skeleton">
    <!-- Header skeleton -->
    <div v-if="showHeader" class="app-skeleton__header">
      <div class="app-skeleton__bar app-skeleton__bar--title" />
      <div class="app-skeleton__bar app-skeleton__bar--subtitle" />
    </div>

    <!-- Action buttons skeleton -->
    <div v-if="showActions" class="app-skeleton__actions">
      <div class="app-skeleton__chip" />
      <div class="app-skeleton__chip" />
      <div class="app-skeleton__chip" />
    </div>

    <!-- List items skeleton -->
    <div class="app-skeleton__list">
      <div
        v-for="i in lines"
        :key="i"
        class="app-skeleton__item"
      >
        <div class="app-skeleton__avatar" />
        <div class="app-skeleton__content">
          <div class="app-skeleton__bar app-skeleton__bar--primary" />
          <div class="app-skeleton__bar app-skeleton__bar--secondary" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-skeleton {
  padding: var(--adv-space-md);
}

.app-skeleton__header {
  padding: var(--adv-space-sm) 0 var(--adv-space-md);
}

.app-skeleton__actions {
  display: flex;
  gap: var(--adv-space-sm);
  margin-bottom: var(--adv-space-md);
}

.app-skeleton__chip {
  width: 72px;
  height: 32px;
  border-radius: var(--adv-radius-full);
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.app-skeleton__list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.app-skeleton__item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-sm) 0;
}

.app-skeleton__avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--adv-radius-md);
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  flex-shrink: 0;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.app-skeleton__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-skeleton__bar {
  border-radius: var(--adv-radius-sm);
  background: var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.app-skeleton__bar--title {
  width: 45%;
  height: 20px;
  margin-bottom: 4px;
}

.app-skeleton__bar--subtitle {
  width: 70%;
  height: 14px;
}

.app-skeleton__bar--primary {
  width: 80%;
  height: 16px;
}

.app-skeleton__bar--secondary {
  width: 55%;
  height: 12px;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
