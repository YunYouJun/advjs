import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { validateCommunityText, validateReportReason } = require('../../cloudbase/functions/marketStats/contract.js')

describe('market community policy', () => {
  it('accepts ordinary review text and trims it', () => {
    expect(validateCommunityText('  很喜欢这个故事  ', { required: true })).toEqual({
      ok: true,
      text: '很喜欢这个故事',
    })
  })

  it('rejects blocked and oversized text', () => {
    expect(validateCommunityText('这是一个诈骗链接', { required: true })).toMatchObject({ ok: false })
    expect(validateCommunityText('a'.repeat(11), { required: true, maxLength: 10 })).toMatchObject({ ok: false })
  })

  it('keeps report reasons deliberately small', () => {
    expect(validateReportReason('copyright')).toBe('copyright')
    expect(validateReportReason('something-else')).toBeNull()
  })

  it('routes replies and reports through the privileged function', () => {
    const source = readFileSync(require.resolve('../../cloudbase/functions/marketStats/index.js'), 'utf8')
    expect(source).toContain('case \'replyReview\':')
    expect(source).toContain('case \'reportProject\':')
    expect(source).toContain('case \'moderateReport\':')
    expect(source).toContain('alreadyRecorded(COLLECTION_REPORTS, key)')

    const rules = JSON.parse(readFileSync(require.resolve('../../cloudbase/security-rules/advjs_reports.json'), 'utf8'))
    expect(rules).toEqual({ read: false, write: false })
  })
})
