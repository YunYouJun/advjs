import type { JsonObject, RuntimeProgram } from '@advjs/types'
import type { SkinId } from './skin-ids'
import afterSchool from './stories/compiled/after-school.json'
import beyondTheMap from './stories/compiled/beyond-the-map.json'
import hamsterSummer from './stories/compiled/hamster-summer.json'
import lastTram from './stories/compiled/last-tram.json'
import observatory from './stories/compiled/observatory.json'

export * from './skin-ids'

/**
 * A story the script demo plays: a small ADV.JS project under `stories/<id>/`, compiled by
 * `scripts/home-stories.ts` through `compileProject` into `stories/compiled/<id>.json`.
 */
export interface Story {
  id: string
  title: string
  program: RuntimeProgram
  /** From `adv/settings/game.json`. */
  variables: JsonObject
  /** Chapters in project order, each with the files joined into it. */
  chapters: { id: string, sources: string[] }[]
  /** Every file in the project, sorted. */
  files: string[]
  /** `chapter#node` → the file and lines that produced it. */
  nodes: Record<string, { file: string, lines: number[] }>
}

const story = (id: string, data: unknown) => ({ id, ...(data as Omit<Story, 'id'>) })

export const stories: Record<SkinId, Story> = {
  tram: story('last-tram', lastTram),
  scifi: story('observatory', observatory),
  romance: story('after-school', afterSchool),
  fantasy: story('beyond-the-map', beyondTheMap),
  book: story('hamster-summer', hamsterSummer),
}
