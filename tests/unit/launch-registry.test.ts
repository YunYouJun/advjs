// @vitest-environment node

import { once } from 'node:events'
import { createConnection } from 'node:net'
import { describe, expect, it } from 'vitest'
import { createLaunchRegistry } from '../launch/helpers/registry'

describe('launch registry lifecycle', () => {
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
