<script lang="ts" setup>
import { ref } from 'vue'
import type { Colord, HslColor, HslaColor, HsvColor, HsvaColor, RgbColor, RgbaColor } from 'colord'
import { colord, getFormat } from 'colord'

const props = defineProps<{
  modelValue: string | RgbaColor | HslaColor | HsvaColor | RgbColor | HslColor | HsvColor
  onChange?: (value: string) => void
}>()

const emit = defineEmits(
  ['update:modelValue', 'change', 'input'],
)

const format = ref(getFormat(props.modelValue) || 'hex')
function formatColor(color: Colord) {
  if (format.value === 'hex')
    return color.toHex()
  else if (format.value === 'rgb')
    return color.toRgb()
  else if (format.value === 'hsl')
    return color.toHsl()
  else if (format.value === 'hsv')
    return color.toHsv()
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
  <input class="agui-color-picker" type="color" opacity @input="onInput" @change="onChange">
</template>

<style lang="scss">
.agui-color-picker {
  width: 100%;
  height: 16px;
  padding: 0;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-color: transparent;

  border: none;
  border-bottom: 2px solid white;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
}
</style>
