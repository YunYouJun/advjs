// virtual module
declare module '@advjs:data' {
  import type { AdvData } from '@advjs/types'

  const advData: AdvData
  export default advData
}

declare module '@advjs/configs/adv' {
  import type { AdvConfig } from '@advjs/types'

  const advConfig: AdvConfig
  export default advConfig
}

declare module '@advjs/configs/app' {
  import type { AppConfig } from '@advjs/types'

  const appConfig: AppConfig
  export default appConfig
}

declare module '@advjs/configs/theme' {
  import type { ThemeConfig } from '@advjs/types'

  const themeConfig: ThemeConfig
  export default themeConfig
}
