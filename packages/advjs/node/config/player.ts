import type { AdvConfig, AdvData } from '@advjs/types'

/** Strip Node-only authoring services from every configuration sent to a player. */
export function toPlayerConfig<T extends Partial<AdvConfig>>(config: T): Omit<T, 'authoring'> {
  const { authoring: _authoring, ...playerConfig } = config
  return playerConfig
}

/** Keep the server's complete authoring data separate from its browser projection. */
export function toPlayerData(data: AdvData): AdvData {
  return { ...data, config: toPlayerConfig(data.config) }
}
