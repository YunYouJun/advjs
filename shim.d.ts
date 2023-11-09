// virtual module
declare module 'virtual:advjs/adv.config' {
  import type { AdvConfig } from '@advjs/types'

  const advConfig: AdvConfig
  export default advConfig
}

declare module 'virtual:advjs/app.config' {
  import type { AppConfig } from '@advjs/types'

  const appConfig: AppConfig
  export default appConfig
}

declare module 'virtual:advjs/theme.config' {
  import type { ThemeConfig } from '@advjs/types'

  const themeConfig: ThemeConfig
  export default themeConfig
}
