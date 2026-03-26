declare interface Window {
  // https://clarity.microsoft.com
  clarity: (action: 'event' | 'set', ...args: any[]) => void
}

// Vite raw imports
declare module '*.md?raw' {
  const content: string
  export default content
}

declare module '*.json?raw' {
  const content: string
  export default content
}
