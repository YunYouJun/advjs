declare module '*.md' {
  import type { ComponentOptions } from 'vue'

  const component: ComponentOptions
  export default component
}

declare module 'mermaid/dist/mermaid.esm.mjs' {
  import Mermaid from 'mermaid/dist/mermaid.d.ts'

  export default Mermaid
}
