import type { AdvCharacter } from '@advjs/types'

export function getCharacter(characters: AdvCharacter[], name: string): AdvCharacter | undefined {
  return characters.find((value) => {
    return value.id === name || value.name === name || (typeof value.alias == 'string' ? value.alias === name : value.alias?.includes(name))
  })
}
