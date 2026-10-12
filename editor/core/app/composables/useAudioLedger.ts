import type { VoiceReviewRow } from '@advjs/audio'
import type { AdvVoiceSynthesisResult, VoiceAuthoringSnapshot, VoiceTakeBindingInput } from '@advjs/types'
import { audioFingerprint, createAudioId, normalizeAudioLocale, resolveVoiceReviewRows, voiceListeningAdoptionEligibility, voiceListeningCandidate, voiceReviewContextFromProgram } from '@advjs/audio'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useAudioStore } from '../stores/useAudioStore'
import { useProjectStore } from '../stores/useProjectStore'
import { readVerifiedVoiceTake } from '../utils/voice-listening-media'

/** Saved project documents are authoritative; every write uses the shared revision protocol. */
export function useAudioLedger() {
  const project = useProjectStore()
  const audio = useAudioStore()
  const snapshot = shallowRef<VoiceAuthoringSnapshot>()
  const lineId = shallowRef('')
  const locale = shallowRef('zh-CN')
  const takeId = shallowRef('')
  const replaceSelected = shallowRef(false)
  const staleReviewed = shallowRef(false)
  const staleKept = shallowRef(false)
  const loading = shallowRef(false)
  const pending = shallowRef(false)
  const error = shallowRef('')
  const previewSource = shallowRef('')
  const previewTakeId = shallowRef('')
  const previewLoading = shallowRef(false)
  const synthesis = shallowRef<AdvVoiceSynthesisResult>()
  const profileRevision = shallowRef('')
  const candidateSource = shallowRef<VoiceTakeBindingInput['source'] | ''>('')
  const license = shallowRef('')
  const subject = shallowRef('')
  const consentRecord = shallowRef('')
  const displayText = shallowRef('')
  const spokenText = shallowRef('')
  const reviewRows = shallowRef<VoiceReviewRow[]>([])
  const reviewLoading = shallowRef(false)
  let reviewSequence = 0
  let revision = 0
  let previewRevision = 0
  let controller: AbortController | undefined

  const writable = computed(() => audio.supportedRoot && Boolean(project.workspace?.writeFiles))
  const sourceLines = computed(() => Object.values(project.project?.compilation.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).filter(node => node.kind === 'dialog' || node.kind === 'narration'))
  const unboundCount = computed(() => sourceLines.value.filter(node => !node.data?.lineId).length)
  const lines = computed(() => {
    const saved = new Map(Object.entries(snapshot.value?.ledger.lines ?? {}).map(([id, line]) => [id, { id, speakerId: line.speakerId, text: line.displayText }]))
    for (const node of sourceLines.value) {
      if (typeof node.data?.lineId === 'string')
        saved.set(node.data.lineId, { id: node.data.lineId, speakerId: String(node.data.speakerId ?? 'narrator'), text: String(node.data.text ?? '') })
    }
    return [...saved.values()]
  })
  const currentLine = computed(() => lines.value.find(line => line.id === lineId.value))
  const binding = computed(() => snapshot.value?.ledger.lines[lineId.value]?.locales[locale.value])
  const take = computed(() => binding.value?.takes.find(item => item.id === takeId.value))
  const takeReview = computed(() => reviewRows.value.find(row => row.lineId === lineId.value && row.locale === locale.value)?.takes.find(item => item.id === takeId.value))
  const reviewRow = computed(() => reviewRows.value.find(row => row.lineId === lineId.value && row.locale === locale.value))
  const candidate = computed(() => synthesis.value?.candidates[0])
  const localeOptions = computed(() => [...new Set(['zh-CN', ...Object.keys(snapshot.value?.ledger.lines[lineId.value]?.locales ?? {}), locale.value])].filter(Boolean))
  const lineOptions = computed(() => lines.value.map(line => ({ value: line.id, label: `${line.speakerId} · ${line.text}` })))
  const takeOptions = computed(() => (binding.value?.takes ?? []).map(item => ({ value: item.id, label: `${item.id === binding.value?.selectedTake ? '已选 · ' : ''}${item.providerId} · ${item.model} · ${item.createdAt}` })))
  const replacing = computed(() => Boolean(binding.value?.selectedTake && binding.value.selectedTake !== takeId.value))
  const adoptionEligibility = computed(() => {
    if (!reviewRow.value || !takeReview.value)
      return false
    try {
      return voiceListeningAdoptionEligibility(voiceListeningCandidate(reviewRow.value, takeId.value), { staleReviewed: staleReviewed.value }).eligible
    }
    catch { return false }
  })
  const canSelect = computed(() => writable.value && adoptionEligibility.value && !reviewLoading.value && take.value?.id !== binding.value?.selectedTake && (!replacing.value || replaceSelected.value) && !pending.value)

  watch([snapshot, () => project.project?.compilation], async () => {
    const current = ++reviewSequence
    reviewRows.value = []
    reviewLoading.value = true
    try {
      if (snapshot.value) {
        const compilation = project.project?.compilation.project
        const context = compilation ? voiceReviewContextFromProgram(compilation.program, Object.fromEntries(compilation.characters.map(character => [character.id, character.voiceProfile])), String(compilation.game.locale ?? 'zh-CN')) : {}
        const rows = await resolveVoiceReviewRows(snapshot.value, context)
        if (current === reviewSequence)
          reviewRows.value = rows
      }
    }
    catch (failure) {
      if (current === reviewSequence)
        error.value = failure instanceof Error ? failure.message : 'VOICE_REVIEW_FAILED'
    }
    finally {
      if (current === reviewSequence)
        reviewLoading.value = false
    }
  }, { immediate: true })

  function clearPreview() {
    previewRevision++
    if (previewSource.value.startsWith('blob:'))
      URL.revokeObjectURL(previewSource.value)
    previewSource.value = ''
    previewTakeId.value = ''
    previewLoading.value = false
  }
  function cancel() {
    revision++
    controller?.abort()
    controller = undefined
    clearPreview()
    loading.value = false
    pending.value = false
    synthesis.value = undefined
    error.value = ''
  }
  async function reload() {
    cancel()
    const source = project.workspace
    if (!source)
      return
    const current = revision
    loading.value = true
    try {
      const result = await audio.authoring().read()
      if (current !== revision || project.workspace !== source)
        return
      snapshot.value = result
      if (!lines.value.some(line => line.id === lineId.value))
        lineId.value = lines.value[0]?.id ?? ''
    }
    catch (failure) {
      if (current === revision)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (current === revision)
        loading.value = false
    }
  }
  watch(() => project.workspace, () => {
    snapshot.value = undefined
    lineId.value = ''
    void reload()
  }, { immediate: true })
  watch(() => project.project?.files[`${project.project.compilation.project.root}/audio/voice-ledger.json`], () => {
    if (!pending.value)
      void reload()
  })
  watch(() => project.project?.files[`${project.project.compilation.project.root}/assets.json`], () => {
    if (!pending.value)
      void reload()
  })
  watch(() => [project.project?.files['adv/audio/pronunciation.json'], project.project?.files['adv/audio/voice-profiles.json']], () => {
    if (!pending.value)
      void reload()
  })
  watch([lineId, locale, binding, currentLine], () => {
    cancel()
    replaceSelected.value = false
    takeId.value = binding.value?.selectedTake ?? binding.value?.takes[0]?.id ?? ''
    const sourceLocale = normalizeAudioLocale(String(project.project?.compilation.project.game.locale ?? 'zh-CN'))
    displayText.value = locale.value === sourceLocale ? currentLine.value?.text ?? '' : binding.value?.displayText ?? currentLine.value?.text ?? ''
    spokenText.value = binding.value?.spokenText ?? snapshot.value?.ledger.lines[lineId.value]?.spokenText ?? ''
  })
  watch(takeId, () => {
    clearPreview()
    replaceSelected.value = false
  })
  const reviewSourceKey = computed(() => JSON.stringify([snapshot.value?.revision, project.project?.compilation.project.program?.hash, project.project?.compilation.project.game.locale, project.project?.compilation.project.characters.map(character => [character.id, character.voiceProfile])]))
  watch([takeId, lineId, locale, displayText, spokenText, reviewSourceKey], () => {
    staleReviewed.value = false
    staleKept.value = false
  }, { flush: 'sync' })
  onBeforeUnmount(() => {
    reviewSequence++
    cancel()
  })

  async function preview(id = takeId.value) {
    clearPreview()
    const item = reviewRow.value?.takes.find(take => take.id === id)
    const source = project.workspace
    const catalog = snapshot.value?.catalog
    if (!item || item.unavailable || !source || !catalog)
      return
    const current = previewRevision
    previewLoading.value = true
    error.value = ''
    try {
      const blob = await readVerifiedVoiceTake(source, catalog, item)
      if (current !== previewRevision || project.workspace !== source)
        return
      previewSource.value = URL.createObjectURL(blob)
      previewTakeId.value = id
    }
    catch (failure) {
      if (current === previewRevision)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (current === previewRevision)
        previewLoading.value = false
    }
  }
  async function select(clear = false) {
    if (!snapshot.value || pending.value || (!clear && !canSelect.value) || (clear && (!replaceSelected.value || !writable.value)))
      return
    const current = revision
    pending.value = true
    error.value = ''
    try {
      const result = await audio.authoring().select({ lineId: lineId.value, locale: locale.value, takeId: clear ? null : takeId.value, expectedRevision: snapshot.value.revision, replaceSelected: replaceSelected.value })
      if (current === revision)
        snapshot.value = result
    }
    catch (failure) {
      if (current === revision)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (current === revision)
        pending.value = false
    }
  }
  async function confirmCurrent() {
    if (!snapshot.value || !takeReview.value?.stale || !adoptionEligibility.value || binding.value?.selectedTake !== takeId.value || pending.value)
      return
    const source = project.workspace
    if (!source)
      return
    const current = revision
    const scope = reviewSourceKey.value
    const item = takeReview.value
    pending.value = true
    error.value = ''
    try {
      await readVerifiedVoiceTake(source, snapshot.value.catalog, item)
      if (current === revision && project.workspace === source && scope === reviewSourceKey.value && staleReviewed.value)
        staleKept.value = true
    }
    catch (failure) {
      if (current === revision)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (current === revision)
        pending.value = false
    }
  }
  async function synthesize() {
    if (!currentLine.value || !audio.canSynthesize || pending.value)
      return
    clearPreview()
    controller?.abort()
    controller = new AbortController()
    const current = revision
    pending.value = true
    error.value = ''
    synthesis.value = undefined
    candidateSource.value = ''
    profileRevision.value = ''
    license.value = subject.value = consentRecord.value = ''
    try {
      const result = await audio.authoring().synthesize({ lineId: lineId.value, locale: locale.value, speakerId: currentLine.value.speakerId, displayText: displayText.value, ...(spokenText.value ? { spokenText: spokenText.value } : {}) }, controller.signal)
      if (current !== revision)
        return
      synthesis.value = result
      const profile = project.project?.compilation.project.characters.find(character => character.id === currentLine.value?.speakerId)?.voiceProfile
      const implementation = profile?.locales?.[locale.value]?.providers[result.candidates[0]!.provider]
      if (profile && implementation && implementation.voiceId === result.candidates[0]?.providerVoiceId) {
        const frozenRevision = await audioFingerprint(profile)
        if (current !== revision)
          return
        profileRevision.value = frozenRevision
        candidateSource.value = implementation.source
        license.value = implementation.rights?.license ?? ''
        subject.value = implementation.rights?.subject ?? ''
        consentRecord.value = implementation.rights?.consentRecord ?? ''
      }
    }
    catch (failure) {
      if (current === revision)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (current === revision)
        pending.value = false
    }
  }
  async function register() {
    if (!snapshot.value || !candidate.value || !currentLine.value || !candidateSource.value || pending.value)
      return
    const current = revision
    pending.value = true
    error.value = ''
    try {
      const extension = candidate.value.path.match(/\.(wav|mp3|ogg|m4a|flac|opus)$/iu)?.[1]?.toLowerCase() ?? 'wav'
      const result = await audio.authoring().register({
        expectedRevision: snapshot.value.revision,
        lineId: lineId.value,
        locale: locale.value,
        speakerId: currentLine.value.speakerId,
        displayText: displayText.value,
        ...(spokenText.value ? { spokenText: spokenText.value } : {}),
        candidate: candidate.value,
        assetPath: `voice/${createAudioId('audio')}.${extension}`,
        voiceProfileRevision: profileRevision.value,
        source: candidateSource.value,
        ...(candidateSource.value === 'cloned' ? { rights: { license: license.value, subject: subject.value, consentRecord: consentRecord.value } } : {}),
      })
      if (current === revision) {
        snapshot.value = result
        synthesis.value = undefined
      }
    }
    catch (failure) {
      if (current === revision)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (current === revision)
        pending.value = false
    }
  }
  return { snapshot, lineId, locale, takeId, takeReview, reviewRow, reviewRows, reviewLoading, replaceSelected, staleReviewed, staleKept, loading, pending, error, previewSource, previewTakeId, previewLoading, currentLine, binding, take, lineOptions, localeOptions, takeOptions, canSelect, replacing, unboundCount, displayText, spokenText, candidate, profileRevision, candidateSource, license, subject, consentRecord, writable, canSynthesize: computed(() => audio.canSynthesize), reload, preview, clearPreview, select, confirmCurrent, synthesize, register }
}
