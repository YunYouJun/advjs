/**
 * CloudBase HTTP function: short link service.
 *
 * Actions:
 *   - create: Generate a short link for a given target URL.
 *   - resolve: Look up a short code and return the target URL.
 *
 * Collection: advjs_shortlinks
 *   { code, targetUrl, projectId?, marketId?, clicks, createdAt }
 */

const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()
const COLLECTION = 'advjs_shortlinks'

// URL-safe, unambiguous characters (no 0/O/1/l/I)
const CHARS = '23456789abcdefghjkmnpqrstuvwxyz'

function generateCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++)
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  return code
}

exports.main = async (event) => {
  const { action, targetUrl, projectId, marketId, code } = event

  if (action === 'create') {
    if (!targetUrl)
      return { error: 'targetUrl required' }

    // Deduplicate: reuse existing short link for same target
    const existing = await db.collection(COLLECTION)
      .where({ targetUrl })
      .limit(1)
      .get()

    if (existing.data && existing.data.length > 0) {
      const rec = existing.data[0]
      return { code: rec.code, url: `${getBaseUrl(event)}/s/${rec.code}` }
    }

    const newCode = generateCode()
    await db.collection(COLLECTION).add({
      code: newCode,
      targetUrl,
      projectId: projectId || null,
      marketId: marketId || null,
      clicks: 0,
      createdAt: Date.now(),
    })

    return { code: newCode, url: `${getBaseUrl(event)}/s/${newCode}` }
  }

  if (action === 'resolve') {
    if (!code)
      return { error: 'code required' }

    const result = await db.collection(COLLECTION)
      .where({ code })
      .limit(1)
      .get()

    if (!result.data || result.data.length === 0)
      return { error: 'not found', status: 404 }

    // Increment click count (non-blocking)
    const _ = db.command
    db.collection(COLLECTION)
      .doc(result.data[0]._id)
      .update({ clicks: _.inc(1) })
      .catch(() => { /* non-critical */ })

    return { targetUrl: result.data[0].targetUrl }
  }

  return { error: 'unknown action' }
}

function getBaseUrl(_event) {
  // Default to studio.advjs.org; can be overridden via env
  // eslint-disable-next-line node/prefer-global/process
  return process.env.SHORT_LINK_BASE || 'https://studio.advjs.org'
}
