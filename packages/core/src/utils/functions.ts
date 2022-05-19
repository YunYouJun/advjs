import type { AdvConfig } from '@advjs/types'

export function getCharacter(characters: AdvConfig.Character[], name: string): AdvConfig.Character | undefined {
  return characters.find((value) => {
    return value.name === name || (typeof value.alias == 'string' ? value.alias === name : value.alias.includes(name))
  })
}
