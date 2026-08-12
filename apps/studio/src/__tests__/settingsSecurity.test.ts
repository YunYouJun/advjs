import { describe, expect, it } from 'vitest'
import { parsePersistedCosConfig, serializeCosConfig } from '../stores/useSettingsStore'

describe('studio COS settings security', () => {
  it('never persists long-lived COS credentials', () => {
    const serialized = serializeCosConfig({
      bucket: 'private-bucket',
      region: 'ap-shanghai',
      secretId: 'AKID-secret',
      secretKey: 'very-secret',
      projectRoot: 'adv-projects/',
      autoSave: true,
      autoSync: false,
      syncInterval: 5,
    })

    expect(serialized).not.toContain('AKID-secret')
    expect(serialized).not.toContain('very-secret')
    expect(JSON.parse(serialized)).not.toHaveProperty('secretId')
    expect(JSON.parse(serialized)).not.toHaveProperty('secretKey')
  })

  it('drops credentials left by an older Studio release', () => {
    const config = parsePersistedCosConfig(JSON.stringify({
      bucket: 'legacy-bucket',
      region: 'ap-shanghai',
      secretId: 'old-id',
      secretKey: 'old-key',
      autoSave: false,
    }))

    expect(config.secretId).toBe('')
    expect(config.secretKey).toBe('')
    expect(config.bucket).toBe('yunlefun-advjs-prod-1325586649')
    expect(config.region).toBe('ap-shanghai')
    expect(config.autoSave).toBe(false)
  })
})
