import fixture from './fixtures/advjs-studio-web.json'

export interface StudioSsoConfig {
  clientId: string
  appId: string
  scope: readonly string[]
  origin: string
  redirectUri: string
  ssoOrigin: string
  exchangeUrl: string
}

interface StudioSsoEnvironmentFixture {
  origin: string
  redirectUri: string
  ssoOrigin: string
  exchangeUrl: string
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value
  }
  catch {
    return false
  }
}

function parseEnvironment(
  environment: StudioSsoEnvironmentFixture,
  common: Pick<StudioSsoConfig, 'appId' | 'clientId' | 'scope'>,
): StudioSsoConfig {
  if (!isHttpsOrigin(environment.origin))
    throw new TypeError('Studio SSO origin must be an exact HTTPS origin')
  const redirect = new URL(environment.redirectUri)
  if (redirect.protocol !== 'https:' || redirect.origin !== environment.origin)
    throw new TypeError('Studio SSO redirect URI must use the registered origin')
  if (redirect.pathname !== '/' || redirect.search || redirect.hash)
    throw new TypeError('Studio SSO redirect URI must be the registered root URL')
  for (const endpoint of [environment.ssoOrigin, environment.exchangeUrl]) {
    if (new URL(endpoint).protocol !== 'https:')
      throw new TypeError('Studio SSO endpoints must use HTTPS')
  }
  return Object.freeze({ ...common, ...environment })
}

const common = Object.freeze({
  appId: fixture.appId,
  clientId: fixture.clientId,
  scope: Object.freeze([...fixture.scope]),
})

export const STUDIO_SSO_CONFIGS = Object.freeze({
  production: parseEnvironment(fixture.production, common),
  firstPartyProduction: parseEnvironment(fixture.firstPartyProduction, common),
  development: parseEnvironment(fixture.development, common),
})

export function resolveStudioSsoConfig(origin: string): StudioSsoConfig | undefined {
  return Object.values(STUDIO_SSO_CONFIGS).find(config => config.origin === origin)
}
