// Global compile-time constants
declare let __DEV__: boolean

declare module '*.vue' {
  import type { defineComponent } from 'vue'

  const component: ReturnType<typeof defineComponent>
  export default component
}

declare let Prism: any
