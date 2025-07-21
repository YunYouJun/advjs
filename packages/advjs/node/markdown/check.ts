import { consola } from 'consola'

export function checkAdvMd(md: string, id: string) {
  if (!md)
    consola.warn(`[adv:loader] entry ${id || 'adv.md'} is empty`)
}
