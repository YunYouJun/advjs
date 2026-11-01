import type { StoryModeSpec } from '@advjs/ai'

/**
 * The Endless Tram: one stop per generated segment, after the hand-written departure in the
 * seed (`../seeds/endless-tram/<locale>/`). The host owns `stop`; the model may only add short
 * `memories`, of which the newest eight are kept.
 */
export const endlessTram: StoryModeSpec = {
  id: 'endless-tram',
  chapterId: index => `s${index}`,
  choices: { min: 2, max: 3 },
  maxNodes: 12,
  limits: {
    zh: { title: 12, plotSummary: 40, text: 300, values: { memories: 12 } },
    en: { title: 32, plotSummary: 120, text: 900, values: { memories: 32 } },
  },
  variables: {
    stop: { actions: [] },
    memories: { actions: ['variables/push-unique'], keep: 8 },
  },
  engine: index => ({ stop: index }),
  rules: `This story is the Endless Tram. Each segment is one stop on a night tram that never reaches a last stop.
- The title is the stop's name: a place, an object, the weather, or someone's name. Never reuse a stop name from the story so far.
- The doors open on the stop. Tell one small, self-contained moment there, in the second person ("you"), and end with what the player might do next: stay a little longer, get back on, or something only this stop offers.
- Xiaoyun, the conductor, may say a line or two. Anyone else at a stop is described in narration and never speaks as "@Name".
- When something at a stop is worth keeping, push one short phrase to "memories", in a choice's actions or in a "type: actions" block. A later stop may echo an earlier memory, lightly.
- Keep it quiet and gentle: no danger and no villains.`,
  examples: ['adv/chapters/tram/01-depart.adv.md'],
  temperature: 0.9,
  maxTokens: 600,
}
