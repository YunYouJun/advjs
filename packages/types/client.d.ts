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

declare module '#advjs/game/chapters' {
  import type { AdvChapter } from '@advjs/types'

  const chapters: AdvChapter[]
  export default chapters
}

declare module '#advjs/game/characters' {
  import type { AdvCharacter } from '@advjs/types'

  const characters: AdvCharacter[]
  export default characters
}

declare module '#advjs/game/scenes' {
  import type { AdvScene } from '@advjs/types'

  const scenes: AdvScene[]
  export default scenes
}
