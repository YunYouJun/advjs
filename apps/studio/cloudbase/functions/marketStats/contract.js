'use strict'

const BLOCKED_TERMS = [
  '诈骗',
  '色情',
  '赌博',
  '毒品',
  '仇恨言论',
  '暴力威胁',
  'hate speech',
  'death threat',
  'porn scam',
]

const REPORT_REASONS = new Set(['spam', 'abuse', 'copyright', 'other'])

function validateCommunityText(value, options = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  const maxLength = Number(options.maxLength) || 1000

  if (options.required && !text)
    return { ok: false, error: 'Content is required' }
  if (text.length > maxLength)
    return { ok: false, error: `Content must be ${maxLength} characters or fewer` }

  const normalized = text.toLowerCase()
  if (BLOCKED_TERMS.some(term => normalized.includes(term)))
    return { ok: false, error: 'Content contains blocked terms' }

  return { ok: true, text }
}

function validateReportReason(value) {
  const reason = typeof value === 'string' ? value : ''
  return REPORT_REASONS.has(reason) ? reason : null
}

module.exports = {
  validateCommunityText,
  validateReportReason,
}
