import type { Character } from '@advjs/types'

export function getCharacter(characters: Character[], name: string): Character | undefined {
  return characters.find((value) => {
    return value.name === name || (typeof value.alias == 'string' ? value.alias === name : value.alias.includes(name))
  })
}
