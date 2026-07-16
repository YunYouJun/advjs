import type { AdvClientRuntimePlugin } from '@advjs/client'
import { civilization, starMap } from '@advjs/plugin-interactions'
import CivilizationActivity from '@advjs/plugin-interactions/client/CivilizationActivity.vue'
import StarMapActivity from '@advjs/plugin-interactions/client/StarMapActivity.vue'

export function createStudioRuntimePlugins(): AdvClientRuntimePlugin[] {
  return [
    Object.assign(starMap(), {
      activityRenderers: {
        'star-map/compare': StarMapActivity,
      },
    }),
    Object.assign(civilization(), {
      activityRenderers: {
        'civilization/initialize': CivilizationActivity,
      },
    }),
  ]
}
