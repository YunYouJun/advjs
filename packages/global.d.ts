declare module '*.vue' {
  import type { defineComponent } from 'vue'
  const component: ReturnType<typeof defineComponent>
  export default component
}

declare let Prism: any

declare module '@windicss/plugin-animations'
