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
