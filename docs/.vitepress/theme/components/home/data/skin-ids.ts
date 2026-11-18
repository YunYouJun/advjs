/**
 * Landing page skins. Each one is a complete little game: its own story, stage and finale,
 * all played by the same runtime. Kept apart from `skins.ts` so the VitePress config can read
 * the ids without bundling the stories.
 */
export const SKINS = ['tram', 'scifi', 'romance', 'fantasy', 'book'] as const

export type SkinId = typeof SKINS[number]

export const DEFAULT_SKIN: SkinId = 'tram'

/** `localStorage` key for the viewer's skin. A `?skin=` query wins for one visit. */
export const SKIN_STORAGE_KEY = 'advjs:home-skin'

export function isSkin(value: unknown): value is SkinId {
  return typeof value === 'string' && (SKINS as readonly string[]).includes(value)
}

/**
 * Picks the skin before first paint: reads `?skin=` or the saved choice and marks `<html>`,
 * so the skin's colours apply before Vue hydrates. Inlined into the page head.
 */
export const skinHeadScript = `;(function(){try{var s=new URLSearchParams(location.search).get('skin');if(!s)s=localStorage.getItem('${SKIN_STORAGE_KEY}');if(s&&/^[a-z]+$/.test(s))document.documentElement.dataset.advSkin=s}catch(e){}})()`

/**
 * How each skin leaves and arrives. A switch is one scene change: the old world exits in its own
 * way, then the new one enters with one of the engine's transition presets, the same names a
 * story uses in `type: background` / `type: transition`. Durations are milliseconds.
 */
export const SKIN_TRANSITIONS: Record<SkinId, { exit: number, enter: { name: string, duration: number } }> = {
  tram: { exit: 760, enter: { name: 'wipe-left', duration: 820 } },
  scifi: { exit: 680, enter: { name: 'fade', duration: 900 } },
  romance: { exit: 420, enter: { name: 'crossfade', duration: 560 } },
  fantasy: { exit: 420, enter: { name: 'dissolve', duration: 560 } },
  book: { exit: 420, enter: { name: 'crossfade', duration: 560 } },
}
