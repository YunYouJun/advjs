<script setup lang="ts">
import type { NumericProps } from './numeric'
import { computed, nextTick, shallowRef, useId, watch } from 'vue'
import numberDrag from '../../actions/numberDrag'
import { clampNumber, stepNumber } from './numeric'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<NumericProps & { slider?: boolean, title?: string }>(), {
  suffix: '',
  location: 'ALONE',
  step: 0.1,
})
const emit = defineEmits<{
  'change': [value: number]
  'update:modelValue': [value: number]
}>()
const uid = useId()
const inputId = computed(() => props.id || `agui-number-${uid}`)
const input = shallowRef<HTMLInputElement>()
const focused = shallowRef(false)
const active = shallowRef(false)
const draft = shallowRef(String(props.modelValue))
const text = computed(() => focused.value ? draft.value : `${props.modelValue}${props.suffix}`)
const progress = computed(() => {
  if (props.min === undefined || props.max === undefined || props.max <= props.min)
    return undefined
  return `${clampNumber((props.modelValue - props.min) / (props.max - props.min) * 100, 0, 100)}%`
})
watch(() => props.modelValue, (value) => {
  if (!focused.value)
    draft.value = String(value)
})

function readDraft() {
  if (!draft.value.trim())
    return undefined
  const value = Number(draft.value)
  return Number.isFinite(value) ? clampNumber(value, props.min, props.max) : undefined
}
function change(value: number) {
  if (props.disabled || !Number.isFinite(value))
    return
  const next = clampNumber(value, props.min, props.max)
  draft.value = String(next)
  if (next !== props.modelValue) {
    emit('change', next)
    emit('update:modelValue', next)
  }
}
function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value
  const next = readDraft()
  if (!props.disabled && next !== undefined && next !== props.modelValue)
    emit('change', next)
}
function onFocus() {
  focused.value = true
  draft.value = String(props.modelValue)
  nextTick(() => input.value?.select())
}
function onBlur() {
  if (!focused.value)
    return
  const next = readDraft()
  if (next !== undefined)
    change(next)
  else
    emit('change', props.modelValue)
  focused.value = false
}
function stepBy(direction: number) {
  change(stepNumber(readDraft() ?? props.modelValue, direction * props.step))
}
function onKeydown(event: KeyboardEvent) {
  if (props.disabled)
    return
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    stepBy(event.key === 'ArrowUp' ? 1 : -1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    input.value?.blur()
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    draft.value = String(props.modelValue)
    emit('change', props.modelValue)
    focused.value = false
    input.value?.blur()
  }
}
const vNumberDrag = numberDrag({
  props,
  onChange: change,
  onClick: () => input.value?.focus(),
  onDown: () => active.value = true,
  onUp: () => active.value = false,
})
</script>

<template>
  <div
    class="agui-numeric-control"
    :class="[$attrs.class, { focused, active, 'is-slider': slider, 'is-disabled': disabled }]"
    :style="$attrs.style"
    :data-location="location"
  >
    <div v-if="slider && progress && !focused" class="agui-numeric-progress" :style="{ width: progress }" />
    <label v-if="slider && title && !focused" class="agui-numeric-title" :for="inputId">{{ title }}</label>
    <input
      v-bind="{ ...$attrs, class: undefined, style: undefined }"
      :id="inputId"
      ref="input"
      class="agui-numeric-input"
      type="text"
      inputmode="decimal"
      role="spinbutton"
      :aria-label="label || title || ($attrs['aria-label'] as string | undefined)"
      :aria-valuenow="modelValue"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuetext="`${modelValue}${suffix}`"
      :disabled="disabled"
      :value="text"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    >
    <div v-if="!focused && step && !disabled" v-number-drag class="agui-numeric-drag" aria-hidden="true" />
    <template v-if="!slider && step">
      <button type="button" class="agui-numeric-step decrease" :aria-label="`Decrease ${label || title || ''}`.trim()" :disabled="disabled || (min !== undefined && modelValue <= min)" tabindex="-1" @pointerdown.prevent @click="stepBy(-1)">
        −
      </button>
      <button type="button" class="agui-numeric-step increase" :aria-label="`Increase ${label || title || ''}`.trim()" :disabled="disabled || (max !== undefined && modelValue >= max)" tabindex="-1" @pointerdown.prevent @click="stepBy(1)">
        +
      </button>
    </template>
  </div>
</template>

<style lang="scss">
.agui-numeric-control {
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  height: var(--agui-control-height);
  color: var(--agui-c-text-1);
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-control-border);
  border-radius: 2px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  &:hover:not(.is-disabled) {
    border-color: var(--agui-c-text-2);
  }
  &:focus-within {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &[data-location='TOP'] {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  &[data-location='MIDDLE'] {
    border-radius: 0;
  }
  &[data-location='BOTTOM'] {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
  .agui-numeric-input {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding: 0 24px;
    border: 0;
    outline: none;
    color: inherit;
    background: transparent;
    text-align: center;
    font: inherit;
    font-variant-numeric: inherit;
    &:disabled {
      cursor: not-allowed;
    }
  }
  &.is-slider .agui-numeric-input {
    padding: 0 6px;
    text-align: right;
  }
  &.focused .agui-numeric-input {
    text-align: center;
  }
  .agui-numeric-drag {
    position: absolute;
    inset: 0 24px;
    cursor: ew-resize;
    touch-action: none;
  }
  &.is-slider .agui-numeric-drag {
    inset: 0;
  }
  .agui-numeric-progress {
    position: absolute;
    inset-block: 0;
    left: 0;
    background: var(--agui-c-selection);
    pointer-events: none;
  }
  .agui-numeric-title {
    position: absolute;
    inset-block: 0;
    left: 6px;
    display: flex;
    align-items: center;
    max-width: 55%;
    overflow: hidden;
    white-space: nowrap;
    pointer-events: none;
  }
  .agui-numeric-step {
    position: absolute;
    inset-block: -1px;
    width: 24px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    &.decrease {
      left: -1px;
    }
    &.increase {
      right: -1px;
    }
    &:hover:enabled {
      background: var(--agui-c-control-hover);
    }
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    &:focus-visible {
      outline: 2px solid var(--agui-c-focus);
      outline-offset: -2px;
    }
  }
}
</style>
