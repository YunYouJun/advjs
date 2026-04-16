<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnboardingTour } from '../composables/useOnboardingTour'

const { t } = useI18n()
const { isActive, currentStep, currentIndex, totalSteps, next, skip } = useOnboardingTour()

const tooltipStyle = ref<Record<string, string>>({})
const highlightStyle = ref<Record<string, string>>({})

function updatePosition() {
  const step = currentStep.value
  if (!step)
    return

  const el = document.querySelector(step.selector) as HTMLElement | null
  if (!el) {
    // If element not found, try next step
    next()
    return
  }

  const rect = el.getBoundingClientRect()
  const padding = 6

  // Highlight box around target
  highlightStyle.value = {
    top: `${rect.top - padding}px`,
    left: `${rect.left - padding}px`,
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
  }

  // Tooltip position based on placement
  const tooltip: Record<string, string> = {}
  const gap = 12

  switch (step.placement) {
    case 'bottom':
      tooltip.top = `${rect.bottom + gap}px`
      tooltip.left = `${Math.max(16, rect.left + rect.width / 2 - 140)}px`
      break
    case 'top':
      tooltip.bottom = `${window.innerHeight - rect.top + gap}px`
      tooltip.left = `${Math.max(16, rect.left + rect.width / 2 - 140)}px`
      break
    case 'left':
      tooltip.top = `${rect.top + rect.height / 2 - 40}px`
      tooltip.right = `${window.innerWidth - rect.left + gap}px`
      break
    case 'right':
      tooltip.top = `${rect.top + rect.height / 2 - 40}px`
      tooltip.left = `${rect.right + gap}px`
      break
  }

  tooltipStyle.value = tooltip
}

watch([currentStep, isActive], async () => {
  if (isActive.value && currentStep.value) {
    await nextTick()
    updatePosition()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="onboarding">
      <div v-if="isActive && currentStep" class="onboarding-overlay" @click.self="skip">
        <!-- Highlight ring around target -->
        <div class="onboarding-highlight" :style="highlightStyle" />

        <!-- Tooltip -->
        <div class="onboarding-tooltip" :style="tooltipStyle">
          <div class="onboarding-tooltip__step">
            {{ currentIndex + 1 }} / {{ totalSteps }}
          </div>
          <h3 class="onboarding-tooltip__title">
            {{ t(currentStep.titleKey) }}
          </h3>
          <p class="onboarding-tooltip__desc">
            {{ t(currentStep.descKey) }}
          </p>
          <div class="onboarding-tooltip__actions">
            <button class="onboarding-tooltip__btn onboarding-tooltip__btn--skip" @click="skip">
              {{ t('onboarding.skip') }}
            </button>
            <button class="onboarding-tooltip__btn onboarding-tooltip__btn--next" @click="next">
              {{ currentIndex === totalSteps - 1 ? t('onboarding.done') : t('onboarding.next') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.5);
}

.onboarding-highlight {
  position: fixed;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  border: 2px solid var(--ion-color-primary, #6366f1);
  z-index: 100000;
  pointer-events: none;
  transition: all 0.3s ease;
}

.onboarding-tooltip {
  position: fixed;
  width: 280px;
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
  z-index: 100001;
  transition: all 0.3s ease;
}

:root.dark .onboarding-tooltip {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.onboarding-tooltip__step {
  font-size: 11px;
  color: var(--adv-text-tertiary, #94a3b8);
  margin-bottom: 4px;
}

.onboarding-tooltip__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--adv-text-primary, #1e293b);
  margin: 0 0 6px;
}

.onboarding-tooltip__desc {
  font-size: 13px;
  color: var(--adv-text-secondary, #64748b);
  margin: 0 0 14px;
  line-height: 1.5;
}

.onboarding-tooltip__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.onboarding-tooltip__btn {
  padding: 6px 14px;
  border-radius: var(--adv-radius-md, 8px);
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.onboarding-tooltip__btn--skip {
  background: transparent;
  color: var(--adv-text-tertiary, #94a3b8);
}

.onboarding-tooltip__btn--next {
  background: var(--ion-color-primary, #6366f1);
  color: #fff;
}

.onboarding-enter-active,
.onboarding-leave-active {
  transition: opacity 0.3s ease;
}

.onboarding-enter-from,
.onboarding-leave-to {
  opacity: 0;
}
</style>
