import { assertEditorServerCapability } from '../utils/capabilities'

const startAt = Date.now()
let count = 0

export default defineEventHandler(() => {
  assertEditorServerCapability('analytics')
  return {
    pageview: count++,
    startAt,
  }
})
