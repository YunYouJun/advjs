import type { VoiceDesignDraft, VoiceDesignPreviewReview, VoiceDesignSnapshot } from '@advjs/types'
import type { Ref } from 'vue'
import { audioProjectMediaPath, verifyVoiceCandidateBytes } from '@advjs/audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'
import { createStudioAudioService } from '../utils/projectAudio'
import { applyStudioVoiceDesignMutation, createStudioVoiceDesignPort } from '../utils/voiceDesigner'
import { useManagedVoiceSession } from './useManagedVoiceSession'
import { useProjectContent } from './useProjectContent'

/** Server owns synthesis; the browser owns review and verified native imports. */
export function useVoiceDesigner(active: Ref<boolean>, changed: () => void) {
  const session = useManagedVoiceSession()
  const project = useProjectContent()
  const studio = useStudioStore()
  const snapshot = shallowRef<VoiceDesignSnapshot>()
  const review = shallowRef<VoiceDesignPreviewReview>()
  const busy = shallowRef(false)
  const error = shallowRef('')
  const previewUrl = shallowRef('')
  const previewId = shallowRef('')
  let epoch = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let restorePending = false
  const available = computed(() => Boolean(active.value && session.client.value && snapshot.value?.configured))
  function stopAudio() {
    if (previewUrl.value)
      URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
    previewId.value = ''
  }
  function invalidate() {
    epoch++
    controller?.abort()
    clearTimeout(timer)
    restorePending = false
    stopAudio()
    snapshot.value = undefined
    review.value = undefined
    busy.value = false
    error.value = ''
  }
  function poll() {
    clearTimeout(timer)
    if (active.value && (restorePending || snapshot.value?.previews.some(item => ['running', 'queued'].includes(item.status)))) {
      timer = setTimeout(() => {
        if (!busy.value)
          void run('refresh')
        else poll()
      }, 750)
    }
  }
  async function run(operation: 'read' | 'refresh' | 'save' | 'plan' | 'execute' | 'cancel' | 'audition' | 'sample' | 'register' | 'select' | 'apply', input?: unknown) {
    const client = session.client.value
    if (!client || !active.value || busy.value)
      return
    const capturedEpoch = epoch
    const localController = new AbortController()
    controller = localController
    const signal = localController.signal
    busy.value = true
    error.value = ''
    try {
      await project.whenReady()
      const fs = project.getFs()
      if (!fs)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      const port = createStudioVoiceDesignPort(client)
      if (operation === 'read') {
        await client.syncNativeProject(fs, signal)
        const next = await port.read(signal)
        if (capturedEpoch === epoch)
          snapshot.value = next
      }
      else if (operation === 'refresh') {
        const next = await port.read(signal)
        if (capturedEpoch === epoch) {
          if (review.value && review.value.expectedRevision !== next.revision)
            review.value = undefined
          snapshot.value = next
          restorePending = false
        }
      }
      else if (operation === 'sample') {
        const sample = input as { assetId: string, sha256: string, bytes: number }
        const current = await createStudioAudioService(fs).read()
        const asset = current.catalog.assets.find(asset => asset.id === sample.assetId && asset.sha256 === sample.sha256)
        if (!asset)
          throw new Error('VOICE_DESIGN_SAMPLE_MISSING')
        const blob = await fs.readBlob(audioProjectMediaPath(current.catalog, asset))
        await verifyVoiceCandidateBytes(sample, await blob.arrayBuffer())
        client.assertCurrent()
        if (capturedEpoch === epoch) {
          stopAudio()
          previewUrl.value = URL.createObjectURL(blob)
          previewId.value = sample.assetId
        }
      }
      else if (operation === 'audition') {
        const blob = await port.readPreviewAudio(String(input), signal)
        client.assertCurrent()
        if (capturedEpoch === epoch) {
          stopAudio()
          previewUrl.value = URL.createObjectURL(blob)
          previewId.value = String(input)
        }
      }
      else if (operation === 'cancel') {
        await port.cancelPreview(String(input), signal)
        const next = await port.read(signal)
        if (capturedEpoch === epoch)
          snapshot.value = next
      }
      else if (operation === 'execute') {
        const approved = review.value
        if (!approved)
          return
        // Never retry a lost execute response: restore its durable preview by read.
        review.value = undefined
        restorePending = true
        await port.executePreview({ reviewId: approved.id, reviewHash: approved.reviewHash }, signal)
        const next = await port.read(signal)
        if (capturedEpoch === epoch) {
          snapshot.value = next
          restorePending = false
        }
      }
      else if (snapshot.value) {
        const expectedRevision = snapshot.value.revision
        await client.syncNativeProject(fs, signal)
        if (operation === 'plan') {
          const planned = await port.planPreview({ ...(input as Parameters<typeof port.planPreview>[0]), expectedRevision }, signal)
          if (capturedEpoch === epoch)
            review.value = planned
        }
        else {
          const value = operation === 'save'
            ? await port.saveVersion({ expectedRevision, draft: input as VoiceDesignDraft }, signal)
            : operation === 'register'
              ? await port.registerSample({ expectedRevision, previewId: String(input) }, signal)
              : operation === 'select'
                ? await port.selectSample({ ...(input as Parameters<typeof port.selectSample>[0]), expectedRevision }, signal)
                : await port.applyProfile({ ...(input as Parameters<typeof port.applyProfile>[0]), expectedRevision }, signal)
          await applyStudioVoiceDesignMutation(fs, client, value, signal)
          client.assertCurrent()
          if (capturedEpoch === epoch) {
            snapshot.value = value.snapshot
            review.value = undefined
            changed()
            await project.reload()
          }
        }
      }
    }
    catch (cause) {
      if (capturedEpoch === epoch) {
        const message = cause instanceof Error ? cause.message : ''
        error.value = /^[A-Z][A-Z0-9_]+$/u.test(message) ? message : 'VOICE_DESIGN_REQUEST_FAILED'
      }
    }
    finally {
      if (capturedEpoch === epoch) {
        busy.value = false
        poll()
      }
    }
  }
  watch([active, () => studio.currentProjectId, session.client], () => {
    invalidate()
    if (active.value && session.client.value)
      void run('read')
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(invalidate)
  return { session, snapshot, review, busy, error, available, previewUrl, previewId, stopAudio, reload: () => run('read'), refresh: () => run('refresh'), save: (draft: VoiceDesignDraft) => run('save', draft), plan: (input: Omit<Parameters<ReturnType<typeof createStudioVoiceDesignPort>['planPreview']>[0], 'expectedRevision'>) => run('plan', input), execute: () => run('execute'), cancel: (id: string) => run('cancel', id), audition: (id: string) => run('audition', id), auditionSample: (sample: { assetId: string, sha256: string, bytes: number }) => run('sample', sample), register: (id: string) => run('register', id), select: (input: Omit<Parameters<ReturnType<typeof createStudioVoiceDesignPort>['selectSample']>[0], 'expectedRevision'>) => run('select', input), apply: (input: Omit<Parameters<ReturnType<typeof createStudioVoiceDesignPort>['applyProfile']>[0], 'expectedRevision'>) => run('apply', input) }
}
