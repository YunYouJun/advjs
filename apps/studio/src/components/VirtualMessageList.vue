<script setup lang="ts" generic="T extends { timestamp: number }">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** Message array (reactive) */
  messages: T[]
  /** Estimated single message height in px */
  estimateSize?: number
  /** Whether AI is currently streaming a response */
  isStreaming?: boolean
  /** Whether to show typing indicator */
  showTyping?: boolean
  /** Extra class for each virtual row container */
  rowClass?: string
}>(), {
  estimateSize: 72,
  isStreaming: false,
  showTyping: false,
  rowClass: undefined,
})

const emit = defineEmits<{
  scrolledToTop: []
}>()

defineSlots<{
  /** Each message item slot */
  message: (props: { message: T, index: number, measureRef: (el: Element | null) => void }) => any
  /** Slot for content above the message list (e.g., welcome, empty state, load-more button) */
  header: () => any
  /** Slot for typing indicator / streaming bubble at the bottom */
  footer: () => any
}>()

// --- Scroll element from Ionic IonContent ---
const scrollElementRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

/**
 * Set the scroll element from Ionic's IonContent.
 * Must be called by the parent after LayoutPage is mounted:
 *   const scrollEl = await layoutPageRef.value?.contentRef?.$el?.getScrollElement()
 *   virtualListRef.value?.setScrollElement(scrollEl)
 */
function setScrollElement(el: HTMLElement) {
  scrollElementRef.value = el
}

// Track whether user is near the bottom to decide auto-scroll behavior
const isNearBottom = ref(true)
const NEAR_BOTTOM_THRESHOLD = 150

function checkNearBottom() {
  const el = scrollElementRef.value
  if (!el)
    return
  const { scrollTop, scrollHeight, clientHeight } = el
  isNearBottom.value = scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD
}

// Debounced scroll handler
let scrollRaf = 0
function onScroll() {
  if (scrollRaf)
    return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    checkNearBottom()
    // Check if user scrolled near the top
    const el = scrollElementRef.value
    if (el && el.scrollTop < 80) {
      emit('scrolledToTop')
    }
  })
}

// Attach/detach scroll listener
watch(scrollElementRef, (newEl, oldEl) => {
  if (oldEl)
    oldEl.removeEventListener('scroll', onScroll, { capture: false } as any)
  if (newEl) {
    newEl.addEventListener('scroll', onScroll, { passive: true })
    checkNearBottom()
  }
}, { immediate: true })

onUnmounted(() => {
  if (scrollElementRef.value) {
    scrollElementRef.value.removeEventListener('scroll', onScroll)
  }
  if (scrollRaf)
    cancelAnimationFrame(scrollRaf)
})

// --- Virtualizer ---
const messageCount = computed(() => props.messages.length)

const virtualizer = useVirtualizer({
  count: messageCount as unknown as number,
  getScrollElement: () => scrollElementRef.value,
  estimateSize: () => props.estimateSize,
  overscan: 5,
  // For dynamic height with measureElement
  measureElement: (el) => {
    if (!el)
      return props.estimateSize
    return el.getBoundingClientRect().height
  },
})

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

// --- Auto-scroll to bottom when new messages arrive ---
watch(messageCount, async () => {
  if (isNearBottom.value) {
    await nextTick()
    scrollToBottom()
  }
})

// Also auto-scroll when streaming content changes (isStreaming toggles)
watch(() => props.isStreaming, async (streaming) => {
  if (streaming && isNearBottom.value) {
    await nextTick()
    scrollToBottom()
  }
})

function scrollToBottom(smooth = true) {
  const el = scrollElementRef.value
  if (!el)
    return
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  })
}

function scrollToIndex(index: number) {
  virtualizer.value.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
}

// On mount, scroll to bottom instantly
onMounted(async () => {
  await nextTick()
  await nextTick() // Double nextTick to ensure IonContent has rendered
  scrollToBottom(false)
})

// Expose methods for parent
defineExpose({
  setScrollElement,
  scrollToBottom,
  scrollToIndex,
  virtualizer,
})
</script>

<template>
  <div ref="containerRef" class="virtual-message-list">
    <!-- Header slot (welcome, empty state, load-more button, etc.) -->
    <slot name="header" />

    <!-- Virtual scroll container -->
    <div
      class="virtual-scroll-container"
      :style="{ height: `${totalSize}px`, width: '100%', position: 'relative' }"
    >
      <div
        v-for="item in virtualItems"
        :key="props.messages[item.index]?.timestamp ?? item.index"
        :ref="(el) => { if (el) virtualizer.measureElement(el as Element) }"
        :data-index="item.index"
        :class="rowClass"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${item.start}px)`,
        }"
      >
        <slot
          name="message"
          :message="props.messages[item.index]"
          :index="item.index"
          :measure-ref="(el: Element | null) => { if (el) virtualizer.measureElement(el) }"
        />
      </div>
    </div>

    <!-- Footer slot (typing indicator, streaming bubble, etc.) -->
    <slot name="footer" />
  </div>
</template>

<style scoped>
.virtual-message-list {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.virtual-scroll-container {
  flex-shrink: 0;
}
</style>
