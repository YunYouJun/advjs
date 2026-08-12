import { createHash } from 'node:crypto'

export function digest(algorithm, content, encoding = 'hex') {
  return createHash(algorithm).update(content).digest(encoding)
}

export function sha256(content) {
  return digest('sha256', content)
}
