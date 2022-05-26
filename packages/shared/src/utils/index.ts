export const isClient = typeof window !== 'undefined'
export const isDev = import.meta.env.DEV
export const namespace = 'advjs'

export const ns = (name: string) => {
  return `${namespace}:${name}`
}
