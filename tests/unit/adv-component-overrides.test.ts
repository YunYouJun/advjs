// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPrioritizedComponentGlobs } from '../../packages/advjs/node/vite/components'

let temporaryDirectory = ''

afterEach(async () => {
  if (temporaryDirectory)
    await rm(temporaryDirectory, { recursive: true, force: true })
})

describe('aDV component override priority', () => {
  it('excludes lower-priority components with the same filename', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'adv-component-overrides-'))
    const client = join(temporaryDirectory, 'client')
    const game = join(temporaryDirectory, 'game')
    await mkdir(client, { recursive: true })
    await mkdir(game, { recursive: true })
    await writeFile(join(client, 'AdvSettingsPanel.vue'), '<template>default</template>')
    await writeFile(join(game, 'AdvSettingsPanel.vue'), '<template>game</template>')

    const globs = createPrioritizedComponentGlobs([client, game])
    expect(globs).toContain(`!${join(client, 'AdvSettingsPanel.vue')}`)
    expect(globs).not.toContain(`!${join(game, 'AdvSettingsPanel.vue')}`)
  })
})
