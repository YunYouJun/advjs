import { describe, expect, it } from 'vitest'
import { compileProject } from '../../../packages/core/src/project'

describe('catalog character images in compiled stage commands', () => {
  it.each(['character', 'tachie'])('recognizes %s expressions by stable character ID, name and aliases', async (kind) => {
    for (const name of ['lin', '林', '阿林']) {
      const files = {
        'adv.config.json': JSON.stringify({ schemaVersion: 1, root: 'adv', format: 'adv-md' }),
        'adv/characters/lin.character.md': '---\nid: lin\nname: 林\naliases: [阿林]\n---\n人物。',
        'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'art', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'character/lin/good', kind, type: 'image', characterId: 'lin', expression: 'good', path: 'good.webp' }] }),
        'adv/chapters/intro.adv.md': `# 开场 {#start}\n\n\`\`\`yaml\ntype: tachie\nenter:\n  name: ${name}\n  status: good\n\`\`\`\n\n@lin\n你好。`,
      }
      const result = await compileProject({ id: 'art', files })
      expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
      expect(result.project.program).toBeDefined()
      const missing = await compileProject({ id: 'art', files: { ...files, 'adv/chapters/intro.adv.md': files['adv/chapters/intro.adv.md'].replace('status: good', 'status: missing') } })
      expect(missing.diagnostics.some(item => item.code === 'ADV_RUNTIME_MISSING_TACHIE_STATUS')).toBe(true)
    }
  })
})
