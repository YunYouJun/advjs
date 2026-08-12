export type EditorMode = 'local' | 'online'
export type EditorIntegration = 'analytics' | 'cos' | 'feishu' | 'github'

export interface EditorCapabilities {
  account: boolean
  integrations: Record<EditorIntegration, boolean>
  localWorkspace: true
  mode: EditorMode
  onlineProjects: boolean
}

function enabled(value: string | undefined) {
  return value === '1' || value === 'true'
}

function configured(...values: Array<string | undefined>) {
  return values.every(value => Boolean(value?.trim()))
}

export function resolveEditorCapabilities(env: Record<string, string | undefined>): EditorCapabilities {
  const mode: EditorMode = env.ADVJS_EDITOR_MODE === 'online' ? 'online' : 'local'
  const online = mode === 'online'
  const github = online && configured(
    env.NUXT_OAUTH_GITHUB_CLIENT_ID,
    env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
  )
  const feishu = online && configured(
    env.NUXT_FEISHU_APP_ID,
    env.NUXT_FEISHU_APP_SECRET,
  )

  return {
    account: github || feishu,
    integrations: {
      analytics: online && configured(env.ADVJS_EDITOR_CLARITY_ID),
      cos: online && enabled(env.ADVJS_EDITOR_ENABLE_COS),
      feishu,
      github,
    },
    localWorkspace: true,
    mode,
    onlineProjects: online,
  }
}

export function shouldFetchEditorResource(
  resource: string,
  capabilities: EditorCapabilities,
  currentOrigin?: string,
) {
  if (capabilities.mode === 'online')
    return true

  if (!/^[a-z][a-z\d+.-]*:/i.test(resource))
    return true

  try {
    const url = new URL(resource)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return true
    return currentOrigin !== undefined && url.origin === new URL(currentOrigin).origin
  }
  catch {
    return false
  }
}
