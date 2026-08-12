import type { AdvErrorCode } from '../cli/contracts'

export class AdvCommandError extends Error {
  constructor(
    public code: AdvErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AdvCommandError'
  }
}
