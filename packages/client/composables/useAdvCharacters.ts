import type { AdvContext } from '../types'

export function useAdvCharacters($adv: AdvContext) {
  const { charactersMap } = $adv.resources

  return {
    get(characterId: string) {
      return charactersMap.get(characterId)
    },
  }
}
