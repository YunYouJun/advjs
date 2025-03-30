import type { Connect } from 'vite'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { commonAlias } from '../../../shared/node'

type Jiti = ReturnType<typeof createJiti>
let jiti: Jiti | undefined
export function loadModule<T = unknown>(absolutePath: string): Promise<T> {
  jiti ??= createJiti(fileURLToPath(import.meta.url), {
    // Allows changes to take effect
    moduleCache: false,
    alias: commonAlias as Record<string, string>,
  })
  return jiti.import(absolutePath) as Promise<T>
}

export function getBodyJson(req: Connect.IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('error', reject)
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) || {})
      }
      catch (e) {
        reject(e)
      }
    })
  })
}
