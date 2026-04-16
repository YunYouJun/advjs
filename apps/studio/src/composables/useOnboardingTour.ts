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

  function skip() {
    finish()
  }

  function finish() {
    isActive.value = false
    currentIndex.value = 0
    markCompleted()
  }

  /** Auto-start on first visit (call from App.vue onMounted) */
  function autoStart() {
    if (!isCompleted()) {
      // Delay to let the UI render and settle
      setTimeout(start, 800)
    }
  }

  return {
    isActive,
    currentStep,
    currentIndex,
    totalSteps,
    start,
    next,
    skip,
    autoStart,
  }
}
