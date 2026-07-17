import type { AdvScene } from '@advjs/types'

/** Resolve a runtime background value as a scene id/alias before treating it as a URL. */
export function resolveSceneBackground(value: string, scenes: readonly AdvScene[] = []): string {
  const scene = scenes.find(item => item.id === value || item.alias === value)
  return scene?.type === 'image' ? scene.src : value
}
