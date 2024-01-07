<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import numberDrag from '../actions/numberDrag'

// Props
const props = withDefaults(defineProps<{
  title?: string
  modelValue: number
  suffix?: string
  id?: string
  step?: number
  min?: number
  max?: number
}>(), {
  suffix: '',
  id: '',
  step: 0.1,
})

const emit = defineEmits(['change', 'update:modelValue'])

// Refs
const elRef = ref<HTMLInputElement>()
const focused = ref(false)
const active = ref(false)
const previous = ref(props.modelValue)

// Computed
const text = ref(format(props.modelValue))
const wanted = ref(props.modelValue)

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (wanted.value !== newValue && document.activeElement !== elRef.value) {
    text.value = format(newValue)
    wanted.value = newValue
  }
})

// Methods
function format(val: number) {
  if (val === undefined || Number.isNaN(val))
    return ''

  if (val > 1000000)
    return Math.round(val).toString() + props.suffix

  return (
    val.toFixed(6).substring(0, 7).replace(/\.?0+$/, '') + props.suffix
  )
}

function onInput() {
  const numValue = Number(elRef.value?.value)
  if (Number.isNaN(numValue))
    return

  wanted.value = numValue
  if (props.modelValue !== wanted.value)
    emit('change', wanted.value)
}

function onFocus() {
  previous.value = props.modelValue
  focused.value = true
  if (props.suffix && text.value.endsWith(props.suffix)) {
    text.value = text.value.substring(0, text.value.length - props.suffix.length)
    if (elRef.value)
      elRef.value.value = text.value
  }
  nextTick(() => {
    elRef.value?.select()
  })
}

function onBlur() {
  focused.value = false
  if (wanted.value !== previous.value) {
    emit('change', wanted.value)
    emit('update:modelValue', wanted.value)
  }
  text.value = format(wanted.value)
}

function onChange(next: number) {
  const val = next
  emit('change', val)
  emit('update:modelValue', val)
}

function onClick(e: MouseEvent) {
  const type = (e.target as HTMLElement)?.nodeName
  if (type !== 'BUTTON')
    elRef.value?.focus()
}

function onDown() {
  active.value = true
}
function onUp() {
  active.value = false
}

const vNumberDrag = numberDrag({
  props,
  onChange,
  onClick,
  onDown,
  onUp,
})

const progressWidth = computed(() => {
  const min = props.min
  const max = props.max
  if (typeof min === 'undefined' || typeof max === 'undefined')
    return 0

  const value = props.modelValue

  if (value <= min)
    return `0%`

  if (value >= max)
    return `100%`

  return `${((value - min) / (max - min)) * 100}%`
})
</script>

<template>
  <div class="agui-number-slider" :class="{ active, focused }">
    <div v-if="!focused" class="title">
      {{ title }}
    </div>
    <input
      :id="id"
      ref="elRef"
      v-model="text"
      class="input"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keyup.enter="onBlur"
    >
    <div
      v-if="!focused && step"
      v-number-drag
      class="drag"
    >
      <div
        v-if="(typeof min !== 'undefined') && (typeof max !== 'undefined')"
        class="progress-bar"
        :style="{ width: progressWidth }"
      />
    </div>
  </div>
</template>

<style lang="scss">
.agui-number-slider {
  position: relative;
  height: 18px;

  background: #545454;
  overflow: hidden;

  border-radius: 2px;

  &:not(.focused, .active):hover {
    background: #656565;
  }
  &.active,
  &.focused {
    background-color: #222222;
  }

  .title {
    z-index: 1;

    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;

    display: flex;
    align-items: center;
    justify-content: center;

    color: #e5e5e5;
    font:
      12px system-ui,
      sans-serif;
    text-shadow: 0 1px 2px rgba(black, 0.8);
    pointer-events: none;
  }

  .input {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
    pointer-events: none;

    background-color: transparent;
    color: #e5e5e5;
    border: 0;
    text-align: right;

    outline: none;
    display: block;
    width: 100%;
    box-sizing: border-box;
    font:
      12px system-ui,
      sans-serif;
    padding-top: 2px;
    padding-bottom: 2px;
    padding-right: 4px;
    text-shadow: 0 1px 2px rgba(black, 0.8);

    :not(.focused, .active) &:hover {
      color: #fcfcfc;
    }
    &:focus {
      color: #e5e5e5;
    }
    &::selection {
      background-color: #4570b5;
    }
  }
  .drag {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    cursor: col-resize;
  }

  // Progress
  .progress-bar {
    z-index: 0;
    position: absolute;
    left: 0;

    top: 0;
    bottom: 0;
    background: var(--agui-c-active);
  }
}
</style>
