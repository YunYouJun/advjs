import type { AdvGameConfig } from '@advjs/types'

type GameCollections = Pick<AdvGameConfig, 'chapters' | 'characters' | 'scenes'>

/** A configured collection is authoritative; virtual modules supply missing defaults. */
export function resolveVirtualGameCollections<T extends GameCollections>(game: T, fallback: GameCollections): T {
  return {
    ...game,
    chapters: game.chapters.length ? game.chapters : fallback.chapters,
    characters: game.characters.length ? game.characters : fallback.characters,
    scenes: game.scenes.length ? game.scenes : fallback.scenes,
  }
}
