import type { CompileDiagnostic } from '@advjs/core'
import type { AdvGameConfig } from '@advjs/types'

export interface LoadedImageDimensions {
  width: number
  height: number
}

export type RuntimeImageProbe = (src: string) => Promise<LoadedImageDimensions>

function diagnostic(code: string, severity: 'error' | 'warning', message: string): CompileDiagnostic {
  return { code, severity, message }
}

function positiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

export function validateSpritesheetDeclarations(gameConfig: Readonly<AdvGameConfig>): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = []
  for (const character of gameConfig.characters ?? []) {
    for (const [status, tachie] of Object.entries(character.tachies ?? {})) {
      const sprite = tachie.sprite
      if (!sprite)
        continue
      if (!positiveInteger(sprite.frameWidth)
        || !positiveInteger(sprite.frameHeight)
        || !positiveInteger(sprite.frames)
        || !Number.isFinite(sprite.fps)
        || sprite.fps <= 0) {
        diagnostics.push(diagnostic(
          'ADV_RUNTIME_INVALID_SPRITESHEET',
          'error',
          `Invalid spritesheet metadata: ${character.id}/${status}`,
        ))
      }
    }
  }
  return diagnostics
}

async function browserImageProbe(src: string): Promise<LoadedImageDimensions> {
  if (typeof Image === 'undefined')
    throw new Error('Image probing is unavailable')
  return await new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = setTimeout(() => reject(new Error('image probe timed out')), 5000)
    image.onload = () => {
      clearTimeout(timeout)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('image load failed'))
    }
    image.src = src
  })
}

export async function validateSpritesheetImages(
  gameConfig: Readonly<AdvGameConfig>,
  probe: RuntimeImageProbe = browserImageProbe,
): Promise<CompileDiagnostic[]> {
  const diagnostics: CompileDiagnostic[] = []
  for (const character of gameConfig.characters ?? []) {
    for (const [status, tachie] of Object.entries(character.tachies ?? {})) {
      const sprite = tachie.sprite
      if (!sprite)
        continue
      try {
        const image = await probe(tachie.src)
        const expectedWidth = sprite.frameWidth * sprite.frames
        if (image.width !== expectedWidth || image.height !== sprite.frameHeight) {
          diagnostics.push(diagnostic(
            'ADV_RUNTIME_SPRITESHEET_DIMENSION_MISMATCH',
            'error',
            `Spritesheet ${character.id}/${status} is ${image.width}×${image.height}; expected ${expectedWidth}×${sprite.frameHeight}`,
          ))
        }
      }
      catch (error) {
        diagnostics.push(diagnostic(
          'ADV_RUNTIME_RESOURCE_LOAD_FAILED',
          'warning',
          `Unable to inspect spritesheet ${character.id}/${status}: ${error instanceof Error ? error.message : String(error)}`,
        ))
      }
    }
  }
  return diagnostics
}
