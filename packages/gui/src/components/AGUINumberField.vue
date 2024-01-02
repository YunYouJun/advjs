<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import numberDrag from '../actions/numberDrag'

// Props
const props = withDefaults(defineProps<{
  modelValue: number
  suffix?: string
  location?: 'ALONE' | 'TOP' | 'MIDDLE' | 'BOTTOM'
  id?: string
  step?: number
  min?: number
  max?: number
}>(), {
  suffix: '',
  location: 'ALONE',
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

function onStepDown() {
  if (props.step && typeof props.modelValue === 'number') {
    const val = props.modelValue - props.step
    emit('change', val)
    emit('update:modelValue', val)
  }
}

function onStepUp() {
  if (props.step && typeof props.modelValue === 'number') {
    const val = props.modelValue + props.step
    emit('change', val)
    emit('update:modelValue', val)
  }
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
</script>

<template>
  <div class="agui-number-field" :class="{ active, focused }" :data-location="location" @click="onClick">
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
      <button class="arrow left" @click="onStepDown" />
      <button class="arrow right" @click="onStepUp" />
    </div>
  </div>
</template>

<style lang="scss">
.agui-number-field {
  position: relative;
  background: #545454;
  overflow: hidden;

  &:not(.focused, .active):hover {
    background: #656565;
  }
  &.active,
  &.focused {
    background-color: #222222;
  }

  &[data-location='ALONE'] {
    border-radius: 2px / 3px;
  }
  &[data-location='TOP'] {
    border-top-left-radius: 2px 3px;
    border-top-right-radius: 2px 3px;
    margin-bottom: 1px;
  }
  &[data-location='MIDDLE'] {
    margin-bottom: 1px;
  }
  &[data-location='BOTTOM'] {
    border-bottom-left-radius: 2px 3px;
    border-bottom-right-radius: 2px 3px;
  }

  &:hover {
    .arrow {
      display: block;
    }
  }

  .input {
    background-color: transparent;
    color: #e5e5e5;
    border: 0;
    text-align: center;
    outline: none;
    display: block;
    width: 100%;
    box-sizing: border-box;
    font:
      12px system-ui,
      sans-serif;
    padding-top: 2px;
    padding-bottom: 2px;
    text-shadow: 0 1px 2px rgba(black, 0.8);

    :not(.focused, .active) &:hover {
      background-color: #797979;
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

  &.active {
    .arrow {
      background-color: #222222;
    }
  }
  .arrow {
    position: absolute;
    background: none;
    border: none;
    color: white;
    top: 0;
    bottom: 0;
    width: 13px;
    background: #656565 no-repeat center center;
    display: none;
    cursor: pointer;

    :not(.focused, .active) &:hover {
      background-color: #797979;
    }
    &.left {
      left: 0;
      background-image: var(--b-icon-chevron-left);
    }
    &.right {
      right: 0;
      background-image: var(--b-icon-chevron-right);
    }
  }
}
</style>
