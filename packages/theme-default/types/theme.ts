// eslint-disable-next-line ts/no-namespace
export namespace DefaultTheme {
  export interface Config {
    assets: {
      audio: Record<string, string>
    }

    audio: {
      volume: number
    }
  }
}
