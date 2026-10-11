import { resolve } from 'node:path'
import process from 'node:process'
import { acquireAudioServiceInstance, audioServiceProjectScope, createScopedStsAuthorization, readAudioServiceJson, validateAudioServiceConfiguration, verifyAudioServiceVolume } from './configuration.mjs'

// Only the operator may choose this file. It is not an author-uploaded project config.
export default async function audioServiceConfiguration() {
  const configuration = validateAudioServiceConfiguration(await readAudioServiceJson(process.env.ADVJS_AUDIO_SERVICE_CONFIG))
  await verifyAudioServiceVolume(configuration)
  const release = acquireAudioServiceInstance(configuration.persistence.root)
  try {
    const node = await import('advjs/node')
    const providerFactories = new Map()
    const enabled = new Set(configuration.projects.flatMap(project => project.voice.providers))
    if (enabled.has('openai-tts')) {
      if (!process.env.OPENAI_API_KEY)
        throw new Error('ADV_AUDIO_DEPLOY_OPENAI_KEY_REQUIRED')
      providerFactories.set('openai-tts', (await import('@advjs/plugin-openai/voice')).createOpenAiTtsProvider)
    }
    if (enabled.has('qwen-tts'))
      providerFactories.set('qwen-tts', (await import('@advjs/plugin-qwen-tts')).createQwenTtsProvider)
    const projects = configuration.projects.map(({ voice, ...project }) => ({ ...project, config: { authoring: { voice: { ...voice, providers: voice.providers.map(id => providerFactories.get(id)()), assetManifest: 'adv/assets.json', library: 'authoring/voices/library.json' } } } }))
    for (const project of projects) {
      const voice = project.config.authoring.voice
      for (const [preset, path] of Object.entries(voice.presets)) {
        await readAudioServiceJson(resolve(project.root, path), 1024 * 1024)
        const provider = voice.providers.find(provider => provider.id === voice.presetProviders[preset])
        if (!provider?.inspectPreset)
          throw new Error('ADV_AUDIO_DEPLOY_PRESET_INVALID')
        await provider.inspectPreset({ root: project.root, preset, configPath: path, assetManifestPath: 'adv/assets.json' })
      }
    }
    let publication
    if (configuration.publication) {
      if (['TENCENT_COS_SECRET_ID', 'TENCENT_COS_SECRET_KEY', 'TENCENT_COS_TOKEN', 'ADV_COS_SECRET_ID', 'ADV_COS_SECRET_KEY', 'ADV_COS_TOKEN'].some(name => Boolean(process.env[name])))
        throw new Error('ADV_AUDIO_DEPLOY_STS_FILE_REQUIRED')
      const settings = configuration.publication
      const approvedProfiles = await readAudioServiceJson(settings.approvedToolchains)
      if (!Array.isArray(approvedProfiles) || !approvedProfiles.length)
        throw new Error('AUDIO_TOOLCHAIN_PROFILE_UNAPPROVED')
      const { parseAudioToolchainLock } = await import('@advjs/audio')
      for (const profile of approvedProfiles) {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile) || Object.keys(profile).some(key => !['id', 'ffmpegBuildFingerprint', 'workerImageDigest'].includes(key)))
          throw new Error('AUDIO_TOOLCHAIN_PROFILE_UNAPPROVED')
        parseAudioToolchainLock({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest })
      }
      const actual = await node.probeAudioToolchain()
      if (!approvedProfiles.some(profile => profile.ffmpegBuildFingerprint === actual.fingerprint))
        throw new Error('AUDIO_TOOLCHAIN_PROFILE_UNAPPROVED')
      const { CosStorage } = await import('@advjs/plugin-cos')
      publication = async (context) => {
        const projectPrefix = audioServiceProjectScope(configuration, context.accountId, context.projectId)
        const scope = projectPrefix.split('/').at(-1)
        const getAuthorization = createScopedStsAuthorization({ bucket: settings.bucket, region: settings.region, projectPrefix, readCredentials: () => readAudioServiceJson(resolve(settings.stsDirectory, `${scope}.json`), 16 * 1024, true) })
        return await node.createNodeAudioPublicationHost({ root: context.root, stateDirectory: resolve(configuration.stateDirectory, 'releases', scope), approvedProfiles, projectPrefix, publicBaseUrl: settings.publicBaseUrl, storage: new CosStorage({ bucket: settings.bucket, region: settings.region, prefix: '', getAuthorization }) })
      }
    }
    return { host: configuration.host, port: configuration.port, allowedOrigins: configuration.allowedOrigins, allowedHosts: configuration.allowedHosts, stateDirectory: resolve(configuration.stateDirectory, 'jobs'), authenticate: node.createCloudBaseVoiceSessionAuthenticator(configuration.cloudbase), projects, ...(publication ? { publication } : {}) }
  }
  catch (error) {
    release()
    throw error
  }
}
