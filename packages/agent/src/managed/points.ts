import type { ManagedAgentRuntimeOptions } from './runtime'
import { ManagedAgentTransport } from './transport'

export interface ManagedAgentPointsAccount {
  availableMicroPoints: number
  reservedMicroPoints: number
  chargedMicroPoints: number
  activeTask?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectMicroPoints(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new TypeError(`${field} must be a non-negative safe integer`)
  return Number(value)
}

export function parseManagedAgentPointsAccount(value: unknown): ManagedAgentPointsAccount {
  if (!isRecord(value))
    throw new TypeError('points account must be an object')
  const activeTask = value.activeTask
  if (activeTask !== undefined && (typeof activeTask !== 'string' || !activeTask))
    throw new TypeError('activeTask must be a non-empty string')
  return {
    availableMicroPoints: expectMicroPoints(value.availableMicroPoints, 'availableMicroPoints'),
    reservedMicroPoints: expectMicroPoints(value.reservedMicroPoints, 'reservedMicroPoints'),
    chargedMicroPoints: expectMicroPoints(value.chargedMicroPoints, 'chargedMicroPoints'),
    ...(activeTask ? { activeTask } : {}),
  }
}

export interface ManagedAgentPointsReader {
  getPoints: () => Promise<ManagedAgentPointsAccount>
}

export class ManagedAgentPointsClient implements ManagedAgentPointsReader {
  readonly #transport: ManagedAgentTransport
  readonly #protocol: 'v1' | 'v2'

  constructor(options: ManagedAgentRuntimeOptions) {
    this.#transport = new ManagedAgentTransport(options)
    this.#protocol = options.protocol ?? 'v1'
  }

  getPoints(): Promise<ManagedAgentPointsAccount> {
    return this.#protocol === 'v2'
      ? this.#transport.requestRaw('/ai/v2/points/me', parseManagedAgentPointsAccount)
      : this.#transport.request('/v1/points/me', parseManagedAgentPointsAccount)
  }
}
