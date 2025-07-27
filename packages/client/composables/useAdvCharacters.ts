import type { AdvContext } from '../types'

export function useAdvCharacters($adv: AdvContext) {
  const { charactersMap } = $adv.runtime

  return {
    get(characterId: string) {
      return charactersMap.get(characterId)
    },
  }
}
