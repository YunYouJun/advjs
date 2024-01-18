import type { Vector2 } from '../types'

export function isVector(value: any): value is Vector2 {
  return typeof value === 'object' && value !== null && 'x' in value && 'y' in value
}
