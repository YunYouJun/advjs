import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import { monoPackages } from '../config'

export function getAllPackages() {
  // glob dirs
  const data = fg.sync(
    monoPackages.map(dir => path.resolve(process.cwd(), dir, '*')),
    { onlyDirectories: true },
  )
  return data
}
