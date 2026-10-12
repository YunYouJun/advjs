import type { VoiceListeningSession, VoiceReviewRow } from '@advjs/audio'
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import { attestVoiceListeningSession, compareVoiceListeningCandidates, createVoiceListeningSession, exportVoiceListeningSession, inspectVoiceListeningSession, recordVoiceListeningPlayback, restoreVoiceListeningSession, setVoiceListeningEnvironment, setVoiceListeningSampleReview, voiceListeningAnonymousSamples, voiceListeningCandidate } from '@advjs/audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useProjectDrafts } from '../stores/useProjectDrafts'
import { useProjectStore } from '../stores/useProjectStore'
import { readVoiceListeningDraft, writeVoiceListeningDraft } from '../utils/voice-listening-draft'

/** Advanced review owns private recovery, while its document and rules come from @advjs/audio. */
export function useVoiceListening(options: { rows: () => VoiceReviewRow[], snapshot: () => VoiceAuthoringSnapshot }) {
  const project = useProjectStore()
  const drafts = useProjectDrafts()
  const session = shallowRef<VoiceListeningSession>()
  const error = shallowRef('')
  const status = shallowRef('')
  const groupId = shallowRef('')
  const selectedIds = shallowRef<string[]>([])
  const activeSampleId = shallowRef('')
  const humanConfirmed = shallowRef(false)
  let sequence = 0
  let importSequence = 0
  const projectId = computed(() => project.project?.compilation.project.id ?? '')
  const privateScope = computed(() => drafts.projectId)
  const contextKey = computed(() => JSON.stringify([options.snapshot().revision, project.project?.compilation.project.program?.hash, project.project?.compilation.project.characters.map(character => [character.id, character.voiceProfile])]))
  const candidates = computed(() => options.rows().flatMap(row => row.takes.map((take) => {
    const duration = options.snapshot().catalog.assets.find(asset => asset.id === take.assetId)?.duration
    return voiceListeningCandidate(row, take.id, duration !== undefined && Number.isFinite(duration) && duration > 0 ? duration : undefined)
  })))
  const comparison = computed(() => compareVoiceListeningCandidates(candidates.value))
  const groups = computed(() => comparison.value.groups.filter(group => group.candidates.filter(candidate => !candidate.unavailable).length >= 2))
  const group = computed(() => groups.value.find(group => group.key === groupId.value))
  const groupOptions = computed(() => [...groups.value.map(group => ({ value: group.key, label: `${group.candidates[0]!.locale} · ${group.candidates[0]!.speakerId} · ${group.candidates[0]!.spokenText.slice(0, 48)}` })), { value: '__all__', label: '全部对白组（按组匿名）' }])
  const choices = computed(() => (groupId.value === '__all__' ? candidates.value : group.value?.candidates ?? []).filter(candidate => !candidate.unavailable).map((candidate) => {
    const take = options.rows().flatMap(row => row.takes).find(take => take.id === candidate.takeId)!
    return { candidate, label: `${groupId.value === '__all__' ? `${candidate.locale} · ${candidate.speakerId} · ${candidate.spokenText.slice(0, 32)} · ` : ''}${take.providerId} · ${take.model} · ${take.createdAt}${candidate.stale ? ' · 待复审' : ''}` }
  }))
  const canCreate = computed(() => Boolean(projectId.value) && selectedIds.value.length >= 2 && selectedIds.value.length <= 32)
  const activeSample = computed(() => session.value?.samples.find(sample => sample.id === activeSampleId.value))
  const anonymousSamples = computed(() => session.value ? voiceListeningAnonymousSamples(session.value) : [])
  const activeAnonymousSample = computed(() => anonymousSamples.value.find(sample => sample.id === activeSampleId.value))
  const inspection = computed(() => session.value ? inspectVoiceListeningSession(session.value) : undefined)
  const pendingReasons = computed(() => {
    const messages: Record<string, string> = {
      VOICE_LISTENING_ENVIRONMENT_REQUIRED: '请填写五项听审环境信息。',
      VOICE_LISTENING_HUMAN_ATTESTATION_REQUIRED: '尚未确认由真人完成听审。',
      VOICE_LISTENING_SOURCE_UNAVAILABLE: '原生配音资源不可用。',
      VOICE_LISTENING_DURATION_REQUIRED: '请载入媒体，以核验实际时长。',
      VOICE_LISTENING_COMPLETE_PLAYBACK_REQUIRED: '请完整试听该候选，播放到结尾。',
      VOICE_LISTENING_SIMULATED_PLAYBACK: '模拟播放不具备真人听审资格，请开始新的真实听审。',
      VOICE_LISTENING_SCORES_REQUIRED: '请完成六维评分；缺少可信参考时，参考一致性选 NA。',
      VOICE_LISTENING_DURATION_MISMATCH: '媒体实际时长与登记值不同，请先检查资源。',
    }
    return [...(inspection.value?.pendingReasons ?? []).map(reason => messages[reason] ?? reason), ...(inspection.value?.samples ?? []).flatMap(sample => sample.pendingReasons.map(reason => `${sample.id} · ${messages[reason] ?? reason}`))]
  })
  const currentProfile = computed(() => activeSample.value?.candidate.speakerId === 'narrator' ? options.snapshot().narratorProfile : project.project?.compilation.project.characters.find(character => character.id === activeSample.value?.candidate.speakerId)?.voiceProfile)
  const targetIntent = computed(() => currentProfile.value
    ? Object.entries(currentProfile.value.intent).map(([key, value]) => {
        const labels: Record<string, string> = { ageImpression: '年龄印象', genderExpression: '性别表达', temperament: '气质', speakingStyle: '说话风格', pitch: '音高', pace: '语速' }
        return `${labels[key] ?? key}：${Array.isArray(value) ? value.join('、') : value}`
      }).join('；')
    : '')

  function failure(failure: unknown) {
    error.value = failure instanceof Error ? failure.message : String(failure)
  }
  function reset() {
    session.value = undefined
    activeSampleId.value = ''
    humanConfirmed.value = false
  }
  watch(groupId, () => {
    selectedIds.value = choices.value.slice(0, 32).map(choice => choice.candidate.takeId)
  }, { flush: 'sync' })
  watch([() => project.workspace, projectId, privateScope, () => JSON.stringify(candidates.value), contextKey], () => {
    sequence++
    reset()
    groupId.value = groups.value[0]?.key ?? '__all__'
    selectedIds.value = choices.value.slice(0, 32).map(choice => choice.candidate.takeId)
    error.value = ''
    status.value = ''
    if (!privateScope.value || !projectId.value)
      return
    try {
      const content = readVoiceListeningDraft(localStorage, privateScope.value)
      if (content) {
        session.value = restoreVoiceListeningSession(content, { projectId: projectId.value, candidates: candidates.value })
        activeSampleId.value = session.value.samples[0]?.id ?? ''
        status.value = '已恢复本机评分草稿；请重新试听并确认人工听审。'
      }
    }
    catch (error) { failure(error) }
  }, { immediate: true })
  onScopeDispose(() => {
    sequence++
    importSequence++
  })
  watch(session, (value) => {
    if (!value || !privateScope.value || value.projectId !== projectId.value)
      return
    try {
      writeVoiceListeningDraft(localStorage, privateScope.value, exportVoiceListeningSession(value))
    }
    catch { error.value = '本机草稿保存不可用。请导出听审 JSON，便于稍后恢复。' }
  }, { flush: 'sync' })

  function toggle(takeId: string, checked: boolean) {
    selectedIds.value = checked ? [...new Set([...selectedIds.value, takeId])] : selectedIds.value.filter(id => id !== takeId)
  }
  function create() {
    if (!canCreate.value)
      return
    try {
      const selected = choices.value.filter(choice => selectedIds.value.includes(choice.candidate.takeId)).map(choice => choice.candidate)
      session.value = createVoiceListeningSession({ projectId: projectId.value, candidates: selected })
      activeSampleId.value = session.value.samples[0]?.id ?? ''
      humanConfirmed.value = false
      error.value = ''
      status.value = '候选已匿名排列；请分别完整试听并填写六维评分。'
    }
    catch (error) { failure(error) }
  }
  function updateReview(input: Parameters<typeof setVoiceListeningSampleReview>[2]) {
    if (!session.value || !activeSampleId.value)
      return
    try {
      session.value = setVoiceListeningSampleReview(session.value, activeSampleId.value, input)
      humanConfirmed.value = false
      error.value = ''
    }
    catch (error) { failure(error) }
  }
  function updateEnvironment(environment: VoiceListeningSession['environment']) {
    if (!session.value)
      return
    try {
      session.value = setVoiceListeningEnvironment(session.value, environment)
      humanConfirmed.value = false
      error.value = ''
    }
    catch (error) { failure(error) }
  }
  function record(sampleId: string, input: Parameters<typeof recordVoiceListeningPlayback>[2]) {
    if (!session.value)
      return
    try {
      session.value = recordVoiceListeningPlayback(session.value, sampleId, input)
    }
    catch (error) { failure(error) }
  }
  function attest() {
    if (!session.value || !humanConfirmed.value || !inspection.value?.canAttest)
      return
    try {
      session.value = attestVoiceListeningSession(session.value, true, 'human-attested')
      error.value = ''
      status.value = '已记录人工听审声明；不会选用或替换任何对白配音。'
    }
    catch (error) { failure(error) }
  }
  function download() {
    if (!session.value)
      return
    const url = URL.createObjectURL(new Blob([exportVoiceListeningSession(session.value)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `voice-listening-${session.value.id.replace(/[^\w-]/gu, '_')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  async function restore(file?: File) {
    if (!file)
      return
    const request = ++importSequence
    const scope = sequence
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error('VOICE_LISTENING_DRAFT_TOO_LARGE')
      const content = await file.text()
      if (request !== importSequence || scope !== sequence)
        return
      session.value = restoreVoiceListeningSession(content, { projectId: projectId.value, candidates: candidates.value })
      activeSampleId.value = session.value.samples[0]?.id ?? ''
      humanConfirmed.value = false
      error.value = ''
      status.value = '已恢复评分和备注；原播放覆盖与人工声明不被复用，请重新试听。'
    }
    catch (error) {
      if (request === importSequence && scope === sequence)
        failure(error)
    }
  }
  return { session, error, status, groupId, groupOptions, selectedIds, choices, canCreate, activeSampleId, activeSample, anonymousSamples, activeAnonymousSample, inspection, pendingReasons, targetIntent, humanConfirmed, privateScope, toggle, create, reset, updateReview, updateEnvironment, record, attest, download, restore }
}
