import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Changes to executable entry configs require a fresh native trust decision. */
export async function projectConfigFingerprint(root: string) {
  const names = (await readdir(root)).filter(name => /^(?:adv|game|theme|vite)\.config\.[cm]?[jt]s$/u.test(name)).sort()
  if (!names.length)
    return ''
  const hash = createHash('sha256')
  for (const name of names) hash.update(name).update(await readFile(join(root, name)))
  return hash.digest('hex')
}
