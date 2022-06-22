import consola from 'consola'
import pkg from '../../package.json'

export function checkAdvMd(md: string) {
  if (!md)
    consola.warn(`[${pkg.name}] entry adv.md is empty`)
}
