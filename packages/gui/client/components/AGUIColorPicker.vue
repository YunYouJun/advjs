<script lang="ts" setup>
import type { Colord, HslaColor, HslColor, HsvaColor, HsvColor, RgbaColor, RgbColor } from 'colord'
import { colord, getFormat } from 'colord'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | RgbaColor | HslaColor | HsvaColor | RgbColor | HslColor | HsvColor
  /**
   * @default 255
   * @description The maximum value of the red, green, and blue channels.
   * You can set 1 if you want to use a value between 0 and 1.
   */
  rgbScale?: number
  onChange?: (value: string) => void
}>(), {
  rgbScale: 255,
})

const emit = defineEmits(
  ['update:modelValue', 'change', 'input'],
)

// displayed color value for input
const value = computed(() => {
  // parse color
  const rawValue = props.modelValue as RgbaColor
  if (props.rgbScale !== 255 && typeof rawValue === 'object') {
    const rgba = {
      r: rawValue.r * 255 / props.rgbScale,
      g: rawValue.g * 255 / props.rgbScale,
      b: rawValue.b * 255 / props.rgbScale,
      a: rawValue.a,
    }
    return colord(rgba).toHex()
  }
  else {
    return colord(rawValue).toHex()
  }
})
const format = computed(() => getFormat(props.modelValue) || 'hex')

function formatColor(color: Colord) {
  if (format.value === 'hex') {
    return color.toHex()
  }
  else if (format.value === 'rgb') {
    const rgba = color.toRgb()
    if (props.rgbScale === 255) {
      return rgba
    }
    else {
      return {
        r: rgba.r / 255 * props.rgbScale,
        g: rgba.g / 255 * props.rgbScale,
        b: rgba.b / 255 * props.rgbScale,
        a: rgba.a,
      }
    }
  }
  else if (format.value === 'hsl') {
    return color.toHsl()
  }
  else if (format.value === 'hsv') {
    return color.toHsv()
  }
  return color.toHex()
}

function onChange(e: Event) {
  const targetVal = (e.target as HTMLInputElement)?.value
  const val = formatColor(colord(targetVal))
  emit('update:modelValue', val)
  emit('change', val)
}

function onInput(e: Event) {
  const targetVal = (e.target as HTMLInputElement)?.value
  const val = formatColor(colord(targetVal))
  emit('update:modelValue', val)
  emit('input', val)
}
</script>

<template>
  <input class="agui-color-picker" :value="value" type="color" opacity @input="onInput" @change="onChange">
</template>

<style lang="scss">
.agui-color-picker {
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  height: var(--agui-control-height);
  padding: 3px var(--agui-space-1);
  cursor: pointer;
  appearance: none;
  background-color: var(--agui-c-field);
  border: 1px solid var(--agui-c-control-border);
  border-radius: var(--agui-radius-sm);

  &:hover:not(:disabled) {
    border-color: var(--agui-c-border-hover);
  }
  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  &::-webkit-color-swatch {
    border: 0;
    border-radius: 2px;
  }
  &::-moz-color-swatch {
    border: 0;
    border-radius: 2px;
  }
}
</style>
