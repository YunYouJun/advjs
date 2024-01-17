export * from './panel'

export * from '../components/breadcrumb/types'
export * from '../components/tree/types'
export * from '../components/explorer/types'
export * from '../components/accordion/types'
export * from '../components/panel/types'

export interface Vector2 {
  x: number
  y: number
}

export interface Vector3 extends Vector2 {
  z: number
}

export interface Vector4 extends Vector3 {
  w: number
}

export type Vector = Vector2 | Vector3 | Vector4
