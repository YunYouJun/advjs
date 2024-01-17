export interface AGUILayoutType {
  name: string
  type?: 'horizontal' | 'vertical'
  size?: number
  min?: number
  max?: number
  children?: AGUILayoutType[]
}
