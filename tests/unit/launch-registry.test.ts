// @vitest-environment node

import { once } from 'node:events'
import { createConnection } from 'node:net'
import { describe, expect, it } from 'vitest'
import { createLaunchRegistry, shouldRemoveLaunchTemporaryRoot } from '../launch/helpers/registry'

describe('launch registry lifecycle', () => {
  it('leaves large package-manager caches to ephemeral Windows runners', () => {
    expect(shouldRemoveLaunchTemporaryRoot('win32', 'true')).toBe(false)
    expect(shouldRemoveLaunchTemporaryRoot('win32', '1')).toBe(false)
    expect(shouldRemoveLaunchTemporaryRoot('win32', undefined)).toBe(true)
    expect(shouldRemoveLaunchTemporaryRoot('darwin', 'true')).toBe(true)
  })

  it('closes without waiting for incomplete client connections', async () => {
    const registry = await createLaunchRegistry({ packages: [] }, '.')
    const registryUrl = new URL(registry.url)
    const socket = createConnection({
      host: registryUrl.hostname,
      port: Number(registryUrl.port),
    })

    await once(socket, 'connect')
    socket.on('error', () => {})
    const socketClosed = new Promise<void>(resolveClose => socket.once('close', () => resolveClose()))
    socket.write('GET /incomplete HTTP/1.1\r\nHost: registry.local\r\n')

    await expect(registry.close()).resolves.toBeUndefined()
    await socketClosed
    expect(socket.destroyed).toBe(true)
  }, 5_000)
})
