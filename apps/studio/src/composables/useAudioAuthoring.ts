import type { VoiceAuthoringAdapter } from '@advjs/types'
import { createStudioAudioService, initializeStudioAudioCatalog } from '../utils/projectAudio'
import { useProjectContent } from './useProjectContent'

/** TTS is injected by the trusted host; secrets never enter project documents. */
export function useAudioAuthoring(synthesize?: VoiceAuthoringAdapter['synthesize']) {
  const project = useProjectContent()
  function service() {
    const fs = project.getFs()
    if (!fs)
      throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
    return createStudioAudioService(fs, synthesize)
  }
  return {
    forProject: service,
    read: () => service().read(),
    synthesize: (...args: Parameters<ReturnType<typeof service>['synthesize']>) => service().synthesize(...args),
    register: (...args: Parameters<ReturnType<typeof service>['register']>) => service().register(...args),
    select: (...args: Parameters<ReturnType<typeof service>['select']>) => service().select(...args),
    readProjectAudio: () => service().readProjectAudio(),
    importAsset: (...args: Parameters<ReturnType<typeof service>['importAsset']>) => service().importAsset(...args),
    updateAsset: (...args: Parameters<ReturnType<typeof service>['updateAsset']>) => service().updateAsset(...args),
    preflightRemoveAsset: (...args: Parameters<ReturnType<typeof service>['preflightRemoveAsset']>) => service().preflightRemoveAsset(...args),
    removeAsset: (...args: Parameters<ReturnType<typeof service>['removeAsset']>) => service().removeAsset(...args),
    saveMixer: (...args: Parameters<ReturnType<typeof service>['saveMixer']>) => service().saveMixer(...args),
    initialize: (catalogId: string) => {
      const fs = project.getFs()
      if (!fs)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      return initializeStudioAudioCatalog(fs, catalogId)
    },
    canSynthesize: Boolean(synthesize),
  }
}
