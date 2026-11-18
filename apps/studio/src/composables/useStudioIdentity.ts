import type { InjectionKey } from 'vue'
import type { StudioIdentityCoordinator } from '../auth/identity-coordinator'
import { inject } from 'vue'

export const studioIdentityInjectionKey: InjectionKey<StudioIdentityCoordinator> = Symbol('studio:identity')
export function useStudioIdentity() {
  return inject(studioIdentityInjectionKey, undefined)
}
