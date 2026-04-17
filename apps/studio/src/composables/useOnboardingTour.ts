import { computed, ref } from 'vue'

const STORAGE_KEY = 'advjs-onboarding-completed'

export interface OnboardingStep {
  id: string
  /** CSS selector for the target element to highlight */
  selector: string
  /** i18n key for the title */
  titleKey: string
  /** i18n key for the description */
  descKey: string
  /** Tooltip placement */
  placement: 'top' | 'bottom' | 'left' | 'right'
}

const defaultSteps: OnboardingStep[] = [
  {
    id: 'quick-start',
    selector: '.quick-start-btn',
    titleKey: 'onboarding.quickStartTitle',
    descKey: 'onboarding.quickStartDesc',
    placement: 'bottom',
  },
  {
    id: 'tab-world',
    selector: 'ion-tab-button[tab="world"]',
    titleKey: 'onboarding.worldTitle',
    descKey: 'onboarding.worldDesc',
    placement: 'top',
  },
  {
    id: 'tab-chat',
    selector: 'ion-tab-button[tab="chat"]',
    titleKey: 'onboarding.chatTitle',
    descKey: 'onboarding.chatDesc',
    placement: 'top',
  },
  {
    id: 'tab-play',
    selector: 'ion-tab-button[tab="play"]',
    titleKey: 'onboarding.playTitle',
    descKey: 'onboarding.playDesc',
    placement: 'top',
  },
  {
    id: 'tab-me',
    selector: 'ion-tab-button[tab="me"]',
    titleKey: 'onboarding.meTitle',
    descKey: 'onboarding.meDesc',
    placement: 'top',
  },
]

const isActive = ref(false)
const currentIndex = ref(0)
/** Whether at least one step was actually rendered to the user in this session */
const hasShownStep = ref(false)

function isCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

function markCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  }
  catch { /* noop */ }
}

/**
 * Check whether any onboarding step has a visible target element in the DOM.
 * Used to skip autoStart on layouts that don't have the expected selectors
 * (e.g. desktop sidebar where ion-tab-button is hidden).
 */
function hasAnyVisibleStep(): boolean {
  return defaultSteps.some(step => !!document.querySelector(step.selector))
}

export function useOnboardingTour() {
  const steps = defaultSteps

  const currentStep = computed(() =>
    isActive.value ? steps[currentIndex.value] ?? null : null,
  )

  const totalSteps = steps.length

  function start() {
    if (isCompleted())
      return
    currentIndex.value = 0
    hasShownStep.value = false
    isActive.value = true
  }

  function next() {
    if (currentIndex.value < steps.length - 1) {
      currentIndex.value++
    }
    else {
      finish()
    }
  }

  /** Called when a step was actually rendered to the user */
  function recordStepShown() {
    hasShownStep.value = true
  }

  function skip() {
    finish()
  }

  function finish() {
    isActive.value = false
    currentIndex.value = 0
    // Only persist completion if at least one step was actually shown.
    // This prevents the desktop layout (no ion-tab-button) from silently
    // consuming the tour and preventing it from ever showing on mobile.
    if (hasShownStep.value) {
      markCompleted()
    }
    hasShownStep.value = false
  }

  /**
   * Auto-start on first visit (call from App.vue onMounted).
   * Skips entirely if no step target elements exist in the current layout.
   */
  function autoStart() {
    if (isCompleted())
      return
    setTimeout(() => {
      // Only start if there is at least one step target visible in the DOM.
      // This avoids silently consuming the tour on desktop-only layouts.
      if (hasAnyVisibleStep()) {
        start()
      }
    }, 800)
  }

  return {
    isActive,
    currentStep,
    currentIndex,
    totalSteps,
    start,
    next,
    skip,
    finish,
    autoStart,
    recordStepShown,
  }
}
