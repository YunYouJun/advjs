import type { AdvConfig, AdvData, AdvGameConfig, VoiceLedger } from '@advjs/types'
import { projectRuntimeFlowChapter, toPlayerCharacter, toPlayerScene } from '@advjs/core'

/** Final serialization removes private authorization and supplier parameters. */
function playerVoiceLedger(ledger: VoiceLedger): VoiceLedger {
  return {
    ...ledger,
    lines: Object.fromEntries(Object.entries(ledger.lines).map(([id, line]) => [id, {
      ...line,
      locales: Object.fromEntries(Object.entries(line.locales).map(([locale, binding]) => [locale, {
        ...binding,
        takes: binding.takes.map((take) => {
          const { rights: _rights, parameters: _parameters, ...publicTake } = take
          return publicTake
        }),
      }])),
    }])),
  }
}

function playerGameAudio<T extends Partial<AdvGameConfig>>(game: T): T {
  return game.audio?.voiceLedger ? { ...game, audio: { ...game.audio, voiceLedger: playerVoiceLedger(game.audio.voiceLedger) } } : game
}

/** Strip Node-only authoring services from every configuration sent to a player. */
export function toPlayerConfig<T extends Partial<AdvConfig>>(config: T): Omit<T, 'authoring'> {
  const { authoring: _authoring, ...playerConfig } = config
  return {
    ...playerConfig,
    ...(playerConfig.gameConfig
      ? { gameConfig: {
          ...playerGameAudio(playerConfig.gameConfig),
          ...(playerConfig.gameConfig.characters ? { characters: playerConfig.gameConfig.characters.map(toPlayerCharacter) } : {}),
          ...(playerConfig.gameConfig.scenes ? { scenes: playerConfig.gameConfig.scenes.map(toPlayerScene) } : {}),
          ...(playerConfig.format === 'flow' && playerConfig.gameConfig.chapters ? { chapters: playerConfig.gameConfig.chapters.map(projectRuntimeFlowChapter) } : {}),
        } }
      : {}),
  }
}

/** Keep the server's complete authoring data separate from its browser projection. */
export function toPlayerData(data: AdvData): AdvData {
  return {
    ...data,
    config: toPlayerConfig(data.config),
    gameConfig: data.gameConfig
      ? {
          ...playerGameAudio(data.gameConfig),
          ...(data.gameConfig.characters ? { characters: data.gameConfig.characters.map(toPlayerCharacter) } : {}),
          ...(data.gameConfig.scenes ? { scenes: data.gameConfig.scenes.map(toPlayerScene) } : {}),
        }
      : data.gameConfig,
  }
}
