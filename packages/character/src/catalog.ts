import type { AdvCharacter } from '@advjs/types'
import { CharacterFrontmatterSchema, formatCharacterFrontmatterError, parseCharacterMd } from '@advjs/parser'

export interface CharacterSource {
  /** Identifier used in diagnostics, usually the source file path. */
  source: string
  content: string
}

export interface CreateCharacterCatalogOptions {
  /** Reject relationships pointing at characters outside this catalog. */
  validateRelationships?: boolean
}

/** Immutable, validated character collection shared by editors and consumers. */
export class CharacterCatalog {
  readonly #characters: readonly AdvCharacter[]
  readonly #byId: ReadonlyMap<string, AdvCharacter>

  constructor(characters: readonly AdvCharacter[], options: CreateCharacterCatalogOptions = {}) {
    const byId = new Map<string, AdvCharacter>()

    for (const character of characters) {
      const result = CharacterFrontmatterSchema.safeParse(character)
      if (!result.success) {
        throw new Error(
          `Invalid character "${character.id || '<unknown>'}":\n${formatCharacterFrontmatterError(result.error)}`,
        )
      }
      if (byId.has(character.id))
        throw new Error(`Duplicate character id "${character.id}"`)
      byId.set(character.id, Object.freeze({ ...character }))
    }

    if (options.validateRelationships !== false) {
      for (const character of byId.values()) {
        for (const relationship of character.relationships ?? []) {
          if (!byId.has(relationship.targetId)) {
            throw new Error(
              `Character "${character.id}" references missing character "${relationship.targetId}"`,
            )
          }
        }
      }
    }

    this.#characters = Object.freeze([...byId.values()])
    this.#byId = byId
  }

  get size(): number {
    return this.#characters.length
  }

  list(): readonly AdvCharacter[] {
    return this.#characters
  }

  has(id: string): boolean {
    return this.#byId.has(id)
  }

  get(id: string): AdvCharacter | undefined {
    return this.#byId.get(id)
  }

  require(id: string): AdvCharacter {
    const character = this.get(id)
    if (!character)
      throw new Error(`Unknown character id "${id}"`)
    return character
  }
}

export function createCharacterCatalog(
  characters: readonly AdvCharacter[],
  options?: CreateCharacterCatalogOptions,
): CharacterCatalog {
  return new CharacterCatalog(characters, options)
}

export function parseCharacterCatalog(
  sources: readonly CharacterSource[],
  options?: CreateCharacterCatalogOptions,
): CharacterCatalog {
  const characters = sources.map(({ source, content }) => {
    try {
      return parseCharacterMd(content)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Unable to parse character source "${source}": ${message}`, { cause: error })
    }
  })

  return createCharacterCatalog(characters, options)
}
