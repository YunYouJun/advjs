import type { DesignedVoiceProfile, VoiceDesignDraft, VoiceDesignMutation, VoiceDesignPort, VoiceDesignPreview, VoiceDesignPreviewReview, VoiceDesignSample, VoiceDesignSnapshot } from '@advjs/types'
import { audioProjectMediaPath, validateVoiceDesignDraft, verifyVoiceCandidateBytes } from '@advjs/audio'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useAudioStore } from '../stores/useAudioStore'
import { useProjectDrafts } from '../stores/useProjectDrafts'
import { useProjectStore } from '../stores/useProjectStore'

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const id = () => `voice-${crypto.randomUUID()}`

/** Local Editor consumes exactly the finite design port used by Studio. */
export function useVoiceDesign(visible: () => boolean) {
  const project = useProjectStore()
  const audio = useAudioStore()
  const drafts = useProjectDrafts()
  const draftId = `voice-design-${crypto.randomUUID()}`
  const snapshot = shallowRef<VoiceDesignSnapshot>()
  const draft = ref<VoiceDesignDraft>()
  const original = shallowRef('')
  const selectedVoiceId = shallowRef('')
  const locale = shallowRef('zh-CN')
  const providerId = shallowRef('')
  const text = shallowRef('你好，这是一段音色试听。')
  const maxCharacters = shallowRef('500')
  const allowUnknownCost = shallowRef(false)
  const budgetReviewed = shallowRef(false)
  const replaceSelected = shallowRef(false)
  const replaceBinding = shallowRef(false)
  const review = shallowRef<VoiceDesignPreviewReview>()
  const loading = shallowRef(false)
  const pending = shallowRef(false)
  const error = shallowRef('')
  const status = shallowRef('')
  const source = shallowRef('')
  const playingPreviewId = shallowRef('')
  let epoch = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let focusedSpeakerId: string | undefined

  const port = computed(() => audio.supportedRoot ? project.workspace?.voiceDesign : undefined)
  const voices = computed(() => (snapshot.value?.library.voices ?? []).filter((voice): voice is DesignedVoiceProfile => Boolean(voice.design)))
  const selected = computed(() => voices.value.find(voice => voice.id === selectedVoiceId.value))
  const dirty = computed(() => Boolean(draft.value) && JSON.stringify(draft.value) !== original.value)
  const immutable = computed(() => Boolean(draft.value && snapshot.value?.library.voices.some(voice => voice.id === draft.value!.id)))
  const available = computed(() => Boolean(port.value && snapshot.value?.configured))
  const localeOptions = computed(() => Object.keys(selected.value?.design.locales ?? {}))
  const providerOptions = computed(() => Object.keys(selected.value?.design.locales[locale.value]?.providers ?? {}).map(id => ({ value: id, label: id })))
  const previews = computed(() => (snapshot.value?.previews ?? []).filter(preview => preview.voiceId === selectedVoiceId.value && preview.locale === locale.value && preview.providerId === providerId.value))
  const samples = computed(() => (selected.value?.design.samples ?? []).filter(sample => sample.locale === locale.value && sample.providerId === providerId.value))
  const selectedSample = computed(() => selected.value?.design.selectedSamples[locale.value]?.[providerId.value])
  const canPlan = computed(() => available.value && !pending.value && !loading.value && !dirty.value && Boolean(selected.value && providerId.value && text.value.trim()) && Number.isSafeInteger(Number(maxCharacters.value)) && Number(maxCharacters.value) > 0 && [...text.value].length <= Number(maxCharacters.value))
  const validation = computed(() => {
    if (!draft.value)
      return ''
    try {
      validateVoiceDesignDraft(draft.value)
      return ''
    }
    catch (failure) {
      const code = failure instanceof Error ? failure.message : 'VOICE_DESIGN_SCHEMA_INVALID'
      return `设计尚不完整，请核对名称、版本、语言和当前来源的必要字段。(${code})`
    }
  })
  const canSave = computed(() => available.value && !pending.value && !loading.value && !immutable.value && Boolean(draft.value) && !validation.value)

  function stopAudio() {
    if (source.value)
      URL.revokeObjectURL(source.value)
    source.value = playingPreviewId.value = ''
  }
  function invalidateReview() {
    review.value = undefined
    budgetReviewed.value = false
  }
  function explain(failure: unknown) {
    const code = failure instanceof Error ? failure.message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/u)?.[1] : undefined
    const descriptions: Record<string, string> = {
      AUDIO_CONFLICT: '项目已变化，草稿保留。请载入最新版本后重新审核。',
      ADV_AUDIO_DESIGN_CONFLICT: '音色或角色已变化，草稿保留。请载入最新版本后重新审核。',
      ADV_AUDIO_DESIGN_REVIEW_STALE: '音色、预设或授权已变化，请重新审核试听计划。',
      ADV_AUDIO_DESIGN_UNKNOWN: '供应商调用结果未知。请查询当前候选状态，不要重复生成。',
      ADV_AUDIO_VOICE_CONSENT_REQUIRED: '参考音色需要已登记媒体、许可和实际存在的项目同意记录。',
      ADV_AUDIO_DESIGN_CAPABILITY: '当前供应商没有声明此设计能力，请选择其支持的来源。',
      VOICE_DESIGN_CONFLICT: '项目已变化，草稿保留。请载入最新版本后重新审核。',
      VOICE_DESIGN_REVIEW_STALE: '设计、预设或授权已变化，请重新创建试听审核计划。',
      VOICE_DESIGN_UNKNOWN_COST: '当前插件无法估算费用，请显式审核是否允许在字符预算内生成。',
      VOICE_DESIGN_BUDGET_REVIEW_REQUIRED: '当前插件无法估算费用，请显式审核是否允许在字符预算内生成。',
      VOICE_DESIGN_PROVIDER_NOT_READY: '本地插件环境尚未就绪，请先在可信宿主完成环境准备并重新诊断。',
      VOICE_DESIGN_REFERENCE_CHANGED: '参考音频与已审核哈希不一致，请核对原生素材后创建新版本。',
      VOICE_DESIGN_SAMPLE_REPLACE_REQUIRED: '替换已有音色样本需要明确确认。',
      VOICE_DESIGN_BINDING_REPLACE_REQUIRED: '替换当前角色音色绑定需要明确确认。',
    }
    error.value = code ? `${descriptions[code] ?? '操作未完成，请检查当前音色、预设和媒体状态。'} (${code})` : '音色操作未完成，请检查服务状态并载入最新版本。'
  }
  function setDraft(value: VoiceDesignDraft) {
    draft.value = copy(value)
    original.value = JSON.stringify(draft.value)
  }
  function synchronizeChoices() {
    if (!localeOptions.value.includes(locale.value))
      locale.value = localeOptions.value[0] ?? 'zh-CN'
    if (!providerOptions.value.some(option => option.value === providerId.value))
      providerId.value = providerOptions.value[0]?.value ?? ''
  }
  function selectVoice(value: string) {
    if (dirty.value) {
      error.value = '当前设计草稿未保存，请先保存或明确放弃草稿。'
      return
    }
    stopAudio()
    invalidateReview()
    selectedVoiceId.value = value
    const voice = selected.value
    if (voice)
      setDraft({ id: voice.id, version: voice.version, characterId: voice.characterId, label: voice.label, intent: voice.design.intent, locales: voice.design.locales, ...(voice.design.supersedes ? { supersedes: voice.design.supersedes } : {}) })
    synchronizeChoices()
    replaceSelected.value = replaceBinding.value = false
  }
  function focusRequestedSpeaker() {
    const speakerId = audio.workflowSpeakerId
    if (!speakerId || speakerId === focusedSpeakerId || !snapshot.value)
      return false
    if (dirty.value || pending.value) {
      error.value = '当前音色草稿或审核尚未完成；先保存或放弃草稿，再切换角色。'
      return false
    }
    focusedSpeakerId = speakerId
    const profile = snapshot.value.speakers.find(speaker => speaker.id === speakerId)?.profile
    const applied = Object.values(profile?.locales ?? {}).flatMap(locale => Object.values(locale.providers)).map(binding => binding.projectVoiceId)
    const voice = voices.value.find(voice => voice.characterId === speakerId && applied.includes(voice.id)) ?? voices.value.find(voice => voice.characterId === speakerId)
    if (voice) {
      selectVoice(voice.id)
    }
    else {
      stopAudio()
      invalidateReview()
      selectedVoiceId.value = original.value = ''
      draft.value = undefined
      status.value = '此角色尚无设计版本，请新建音色；历史样本不会自动转换或应用。'
    }
    return true
  }
  function newVersion(duplicate = false) {
    if (dirty.value) {
      error.value = '当前设计草稿未保存，请先保存或明确放弃草稿。'
      return
    }
    stopAudio()
    invalidateReview()
    const previous = duplicate ? selected.value : undefined
    const speaker = snapshot.value?.speakers.find(speaker => speaker.id === (previous?.characterId ?? audio.workflowSpeakerId ?? 'narrator')) ?? snapshot.value?.speakers[0]
    const provider = snapshot.value?.providers.find(provider => provider.presets.length)
    const preset = provider?.presets[0]
    const source = preset?.sources[0] ?? provider?.sources[0] ?? 'system'
    const draftLocale = Object.keys(speaker?.profile?.locales ?? {})[0] ?? 'zh-CN'
    setDraft(previous
      ? { id: id(), version: `${previous.version}.1`, characterId: previous.characterId, label: previous.label, intent: previous.design.intent, locales: previous.design.locales, supersedes: { id: previous.id, version: previous.version } }
      : { id: id(), version: '1', characterId: speaker?.id ?? 'narrator', label: `${speaker?.name ?? '旁白'}音色`, intent: speaker?.profile?.intent ?? {}, locales: provider && preset ? { [draftLocale]: { providers: { [provider.id]: { preset: preset.id, source, ...(source === 'system' && provider.builtInVoices[0] ? { providerVoiceId: provider.builtInVoices[0].id } : {}) } } } } : {} })
    // A new design is a project draft, including its generated immutable ID.
    original.value = ''
    status.value = '新版本尚未保存；保存和试听不会修改角色或对白绑定。'
  }
  function discardDraft() {
    original.value = JSON.stringify(draft.value)
    if (selected.value) {
      selectVoice(selected.value.id)
    }
    else {
      draft.value = undefined
      original.value = ''
    }
    error.value = ''
    status.value = '未保存的音色草稿已放弃。'
  }
  function schedule() {
    clearTimeout(timer)
    if (visible() && snapshot.value?.previews.some(preview => preview.status === 'running' || preview.status === 'queued'))
      timer = setTimeout(() => { void reload() }, 800)
  }
  async function reload() {
    const currentPort = port.value
    if (!currentPort || loading.value)
      return
    const scope = epoch
    const workspace = project.workspace
    loading.value = true
    try {
      const result = await currentPort.read()
      if (scope !== epoch || project.workspace !== workspace)
        return
      if (review.value && review.value.expectedRevision !== result.revision) {
        invalidateReview()
        status.value = '项目输入已变化，请重新创建试听审核计划。'
      }
      snapshot.value = result
      if (!focusRequestedSpeaker() && !selected.value && !dirty.value && voices.value.length && !audio.workflowSpeakerId)
        selectVoice(voices.value[0]!.id)
      else synchronizeChoices()
      error.value = result.unavailableCode ? `当前宿主尚未配置音色设计 (${result.unavailableCode})` : ''
      schedule()
    }
    catch (failure) {
      if (scope === epoch)
        explain(failure)
    }
    finally {
      if (scope === epoch)
        loading.value = false
    }
  }
  async function action(operation: (port: VoiceDesignPort, signal: AbortSignal, current: () => boolean) => Promise<void>) {
    const currentPort = port.value
    if (!currentPort || pending.value)
      return
    const scope = epoch
    const workspace = project.workspace
    const abort = new AbortController()
    controller = abort
    pending.value = true
    error.value = status.value = ''
    const current = () => scope === epoch && project.workspace === workspace && !abort.signal.aborted
    try {
      await operation(currentPort, abort.signal, current)
    }
    catch (failure) {
      if (current())
        explain(failure)
    }
    finally {
      if (scope === epoch)
        pending.value = false
      if (controller === abort)
        controller = undefined
    }
  }
  async function applyMutation(result: VoiceDesignMutation, current: () => boolean) {
    if (!current())
      return
    snapshot.value = result.snapshot
    invalidateReview()
    await project.refreshProject()
  }
  async function save() {
    if (!canSave.value || !draft.value || !snapshot.value)
      return false
    let saved = false
    const value = copy(draft.value)
    const expectedRevision = snapshot.value.revision
    await action(async (service, signal, current) => {
      const result = await service.saveVersion({ expectedRevision, draft: value }, signal)
      if (!current())
        return
      original.value = JSON.stringify(draft.value)
      await applyMutation(result, current)
      if (!current())
        return
      selectVoice(value.id)
      status.value = '设计版本已保存。试听、样本审核与应用绑定需分别确认。'
      saved = true
    })
    return saved
  }
  async function plan() {
    if (!canPlan.value || !snapshot.value)
      return
    invalidateReview()
    await action(async (service, signal, current) => {
      const result = await service.planPreview({ voiceId: selectedVoiceId.value, locale: locale.value, providerId: providerId.value, text: text.value, expectedRevision: snapshot.value!.revision, budget: { maxCharacters: Number(maxCharacters.value), allowUnknownCost: allowUnknownCost.value } }, signal)
      if (current())
        review.value = result
    })
  }
  async function execute() {
    if (!review.value || !budgetReviewed.value)
      return
    const approved = review.value
    await action(async (service, signal, current) => {
      const result = await service.executePreview({ reviewId: approved.id, reviewHash: approved.reviewHash }, signal)
      if (!current())
        return
      invalidateReview()
      snapshot.value = snapshot.value ? { ...snapshot.value, previews: [...snapshot.value.previews.filter(preview => preview.id !== result.id), result] } : undefined
      status.value = '试听已提交。候选不会自动登记、采用或应用角色配置。'
      await reload()
    })
  }
  async function audition(preview: VoiceDesignPreview) {
    await action(async (service, signal, current) => {
      const blob = await service.readPreviewAudio(preview.id, signal)
      const expected = preview.candidate
      if (!current())
        return
      if (!expected || expected.bytes > 20 * 1024 * 1024 || blob.size !== expected.bytes)
        throw new Error('ADV_AUDIO_DESIGN_MEDIA_INVALID')
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (hash !== expected.sha256)
        throw new Error('ADV_AUDIO_DESIGN_MEDIA_INVALID')
      if (!current())
        return
      stopAudio()
      source.value = URL.createObjectURL(blob)
      playingPreviewId.value = preview.id
    })
  }
  async function register(preview: VoiceDesignPreview) {
    if (!snapshot.value)
      return
    const expectedRevision = snapshot.value.revision
    await action(async (service, signal, current) => {
      await applyMutation(await service.registerSample({ previewId: preview.id, expectedRevision }, signal), current)
      if (current())
        status.value = '候选已登记为原生音色样本，尚未选用或应用。'
    })
  }
  async function auditionSample(sample: VoiceDesignSample) {
    await action(async (_service, _signal, current) => {
      const saved = samples.value.find(item => item.assetId === sample.assetId && item.sha256 === sample.sha256)
      const catalog = project.project?.compilation?.project.assets
      const workspace = project.workspace
      const asset = catalog?.assets.find(item => item.id === saved?.assetId)
      if (!saved || !catalog || !asset || asset.type !== 'audio' || asset.sha256 !== saved.sha256 || !workspace?.readAsset || saved.bytes > 20 * 1024 * 1024)
        throw new Error('ADV_AUDIO_DESIGN_MEDIA_INVALID')
      const blob = await workspace.readAsset(audioProjectMediaPath(catalog, asset))
      await verifyVoiceCandidateBytes(saved, await blob.arrayBuffer())
      if (!current())
        return
      stopAudio()
      source.value = URL.createObjectURL(blob)
      playingPreviewId.value = saved.assetId
    })
  }
  async function selectSample(assetId: string) {
    if (!snapshot.value)
      return
    const input = { voiceId: selectedVoiceId.value, locale: locale.value, providerId: providerId.value, assetId, expectedRevision: snapshot.value.revision, replaceSelected: replaceSelected.value }
    await action(async (service, signal, current) => {
      await applyMutation(await service.selectSample(input, signal), current)
      if (current()) {
        replaceSelected.value = false
        status.value = '音色样本已审核选用；角色和对白绑定尚未修改。'
      }
    })
  }
  async function applyProfile() {
    if (!snapshot.value || !selectedSample.value)
      return
    const input = { voiceId: selectedVoiceId.value, locale: locale.value, providerId: providerId.value, expectedRevision: snapshot.value.revision, replaceBinding: replaceBinding.value }
    await action(async (service, signal, current) => {
      await applyMutation(await service.applyProfile(input, signal), current)
      if (current()) {
        replaceBinding.value = false
        status.value = '已应用当前语言的角色／旁白音色。已有对白 take 保留，过期状态由共享指纹检查。'
      }
    })
  }
  async function cancel(preview: VoiceDesignPreview) {
    await action(async (service, signal, current) => {
      await service.cancelPreview(preview.id, signal)
      if (current()) {
        if (playingPreviewId.value === preview.id)
          stopAudio()
        await reload()
      }
    })
  }
  function reset() {
    epoch++
    controller?.abort()
    clearTimeout(timer)
    stopAudio()
    snapshot.value = draft.value = undefined
    original.value = selectedVoiceId.value = providerId.value = ''
    focusedSpeakerId = undefined
    loading.value = pending.value = replaceSelected.value = replaceBinding.value = false
    error.value = status.value = ''
    invalidateReview()
  }
  watch(() => project.workspace, () => {
    reset()
    if (visible())
      void reload()
  }, { immediate: true })
  watch(visible, (value) => {
    if (value) {
      void reload()
    }
    else {
      controller?.abort()
      clearTimeout(timer)
      stopAudio()
    }
  })
  watch([locale, providerId, text, maxCharacters, allowUnknownCost], invalidateReview)
  watch([() => audio.workflowSpeakerId, dirty, pending], () => {
    if (!audio.workflowSpeakerId)
      focusedSpeakerId = undefined
    else focusRequestedSpeaker()
  })
  watch([locale, providerId], () => {
    stopAudio()
    synchronizeChoices()
  })
  watch(() => project.project?.files, () => {
    if (visible() && !pending.value)
      void reload()
  })
  watch(dirty, value => drafts.register(draftId, { dirty: value, save }), { immediate: true })
  onBeforeUnmount(() => {
    reset()
    drafts.remove(draftId)
  })
  return { snapshot, draft, selectedVoiceId, selected, voices, locale, providerId, text, maxCharacters, allowUnknownCost, budgetReviewed, replaceSelected, replaceBinding, review, loading, pending, error, status, source, playingPreviewId, dirty, immutable, available, hasTransport: computed(() => Boolean(port.value)), localeOptions, providerOptions, previews, samples, selectedSample, canPlan, canSave, validation, reload, selectVoice, newVersion, discardDraft, save, plan, execute, audition, auditionSample, register, selectSample, applyProfile, cancel, stopAudio }
}
