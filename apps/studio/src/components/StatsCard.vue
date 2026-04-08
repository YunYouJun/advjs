<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { chevronForwardOutline } from 'ionicons/icons'

defineProps<{
  icon: string
  value: number | string
  label: string
  accent: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="stats__card"
    :data-accent="accent"
    @click="emit('click')"
  >
    <span class="stats__icon"><IonIcon :icon="icon" /></span>
    <span class="stats__value">{{ value }}</span>
    <span class="stats__label">{{ label }}</span>
    <IonIcon :icon="chevronForwardOutline" class="stats__arrow" />
  </button>
</template>

<style scoped>
.stats__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px 12px;
  border-radius: 14px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* Decorative top-bar — uses accent color */
.stats__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgb(var(--_a));
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stats__card:hover::before {
  opacity: 1;
}

.stats__card:hover {
  border-color: rgba(var(--_a), 0.3);
  box-shadow: 0 4px 16px rgba(var(--_a), 0.1);
}

.stats__card:active {
  transform: scale(0.96);
}

.stats__card:focus-visible {
  outline: 2px solid rgb(var(--_a));
  outline-offset: 2px;
}

.stats__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
}

.stats__value {
  font-size: 24px;
  font-weight: 800;
  color: var(--adv-text-primary);
  line-height: 1;
  letter-spacing: -0.03em;
}

.stats__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--adv-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats__arrow {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--adv-text-tertiary);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stats__card:hover .stats__arrow {
  opacity: 0.6;
}

/* ─── Responsive ─── */
@media (max-width: 767px) {
  .stats__value {
    font-size: 20px;
  }

  .stats__label {
    font-size: 10px;
  }
}

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .stats__card,
  .stats__card::before {
    transition: none;
  }
}
</style>
