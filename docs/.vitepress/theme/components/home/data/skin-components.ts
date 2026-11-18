import type { Component } from 'vue'
import type { SkinId } from './skin-ids'
import { defineAsyncComponent } from 'vue'
import TramFinale from '../skins/tram/TramFinale.vue'
import TramHero from '../skins/tram/TramHero.vue'
import TramStage from '../skins/tram/TramStage.vue'

type Part = 'hero' | 'stage' | 'finale'
type Loader = () => Promise<{ default: Component }>

/** The other skins load when someone picks them (or hovers their card). */
const loaders: Record<Exclude<SkinId, 'tram'>, Record<Part, Loader>> = {
  scifi: {
    hero: () => import('../skins/scifi/ScifiHero.vue'),
    stage: () => import('../skins/scifi/ScifiStage.vue'),
    finale: () => import('../skins/scifi/ScifiFinale.vue'),
  },
  romance: {
    hero: () => import('../skins/romance/RomanceHero.vue'),
    stage: () => import('../skins/romance/RomanceStage.vue'),
    finale: () => import('../skins/romance/RomanceFinale.vue'),
  },
  fantasy: {
    hero: () => import('../skins/fantasy/FantasyHero.vue'),
    stage: () => import('../skins/fantasy/FantasyStage.vue'),
    finale: () => import('../skins/fantasy/FantasyFinale.vue'),
  },
  book: {
    hero: () => import('../skins/book/BookHero.vue'),
    stage: () => import('../skins/book/BookStage.vue'),
    finale: () => import('../skins/book/BookFinale.vue'),
  },
}

function lazy(parts: Record<Part, Loader>): Record<Part, Component> {
  return {
    hero: defineAsyncComponent(parts.hero),
    stage: defineAsyncComponent(parts.stage),
    finale: defineAsyncComponent(parts.finale),
  }
}

/**
 * What each skin draws: the opening scene, the script demo's stage and the closing scene.
 * The default skin ships with the page.
 */
export const skinComponents: Record<SkinId, Record<Part, Component>> = {
  tram: { hero: TramHero, stage: TramStage, finale: TramFinale },
  scifi: lazy(loaders.scifi),
  romance: lazy(loaders.romance),
  fantasy: lazy(loaders.fantasy),
  book: lazy(loaders.book),
}

/** Fetches a skin's components ahead of time, so its entrance doesn't wait on the network. */
export async function preloadSkin(id: SkinId): Promise<void> {
  if (id === 'tram')
    return
  await Promise.all(Object.values(loaders[id]).map(load => load())).catch(() => {})
}
