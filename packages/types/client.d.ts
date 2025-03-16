declare module '#advjs/data' {
  import type { AdvData } from '@advjs/types'

  const advData: AdvData
  export default advData
}

declare module '#advjs/styles' {
  // side-effects only
}

// setups

declare module '#advjs/setups/main' {
  import type { AppSetup } from '@advjs/types'

  const setups: AppSetup[]
  export default setups
}

declare module '#advjs/setups/adv' {
  import type { AdvSetup } from '@advjs/types'

  const setups: AdvSetup[]
  export default setups
}
