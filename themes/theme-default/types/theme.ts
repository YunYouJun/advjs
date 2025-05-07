// eslint-disable-next-line ts/no-namespace
export namespace DefaultTheme {
  export interface Config {
    assets?: {
      audio: {
        popDownUrl?: string
      }
    }
    audio?: {
      volume: number
    }
  }
}
