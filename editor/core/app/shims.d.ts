declare interface Window {
  // https://clarity.microsoft.com
  clarity: (action: 'event' | 'set', ...args: any[]) => void
}
