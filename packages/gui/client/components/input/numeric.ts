export interface NumericProps {
  modelValue: number
  suffix?: string
  location?: 'ALONE' | 'TOP' | 'MIDDLE' | 'BOTTOM'
  id?: string
  label?: string
  step?: number
  min?: number
  max?: number
  disabled?: boolean
}

export function clampNumber(value: number, min?: number, max?: number) {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))
}

// Remove arithmetic noise from stepping without shortening typed values.
export function stepNumber(value: number, offset: number) {
  return Number((value + offset).toPrecision(15))
}
