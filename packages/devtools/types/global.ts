declare global {
  interface Window {
    __ADV_DEVTOOLS__?: boolean
    __ADV_DEVTOOLS_GLOBAL_HOOK__: any
  }
}

export {}
