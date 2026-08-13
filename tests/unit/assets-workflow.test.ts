import {
  acceptAdvAssetGenerationCandidate,
  addAdvAssetGenerationCandidate,
  createAdvAssetGenerationReceipt,
  createAdvAssetGenerationTask,
  registerAdvAssetGenerationTask,
  rejectAdvAssetGenerationCandidate,
  validateAdvAssetGenerationTask,
} from '@advjs/assets'
import { describe, expect, it } from 'vitest'

const createdAt = '2026-08-13T08:00:00.000Z'
const generatedAt = '2026-08-13T08:01:00.000Z'

function plannedTask() {
  return createAdvAssetGenerationTask({
    id: '20260813-library-a1b2c3d4',
    projectId: 'example',
    sceneId: 'library',
    prompt: 'A quiet library at dusk',
    width: 1536,
    height: 864,
    createdAt,
  })
}

function generatedTask() {
  return addAdvAssetGenerationCandidate(plannedTask(), {
    id: 'candidate-1',
    path: '.adv/generated/tasks/20260813-library-a1b2c3d4/candidates/candidate-1.webp',
    sha256: 'a'.repeat(64),
    bytes: 1024,
    mimeType: 'image/webp',
    width: 1536,
    height: 864,
    executor: { id: 'codex-imagegen', model: 'imagegen-built-in' },
    createdAt: generatedAt,
  })
}

describe('asset generation workflow', () => {
  it('keeps generated candidates separate until explicit acceptance and registration', () => {
    const generated = generatedTask()
    expect(generated.status).toBe('generated')

    const accepted = acceptAdvAssetGenerationCandidate(generated, 'candidate-1', '2026-08-13T08:02:00.000Z')
    const registered = registerAdvAssetGenerationTask(accepted, {
      assetPath: 'adv/assets/backgrounds/library.aaaaaaaaaaaa.webp',
      manifestPath: 'adv/assets.json',
      scenePath: 'adv/scenes/library.md',
      receiptPath: 'adv/generations/20260813-library-a1b2c3d4.json',
      registeredAt: '2026-08-13T08:03:00.000Z',
    })
    const receipt = createAdvAssetGenerationReceipt(registered)

    expect(registered.status).toBe('registered')
    expect(receipt.assetId).toBe('background/library')
    expect(receipt.candidate.sha256).toBe('a'.repeat(64))
    expect(receipt.registration.assetPath).toContain('library.aaaaaaaaaaaa.webp')
  })

  it('allows rejection followed by another candidate without formal registration', () => {
    const rejected = rejectAdvAssetGenerationCandidate(
      generatedTask(),
      'candidate-1',
      '2026-08-13T08:02:00.000Z',
      'identity drift',
    )
    const retried = addAdvAssetGenerationCandidate(rejected, {
      id: 'candidate-2',
      path: '.adv/generated/tasks/20260813-library-a1b2c3d4/candidates/candidate-2.png',
      sha256: 'b'.repeat(64),
      bytes: 2048,
      mimeType: 'image/png',
      width: 1536,
      height: 864,
      executor: { id: 'other-provider' },
      createdAt: '2026-08-13T08:03:00.000Z',
    })

    expect(retried.registration).toBeUndefined()
    expect(retried.candidates.map(item => item.status)).toEqual(['rejected', 'generated'])
  })

  it('rejects paths outside the owning task directory', () => {
    expect(() => addAdvAssetGenerationCandidate(plannedTask(), {
      id: 'candidate-1',
      path: '.adv/generated/tasks/other/candidates/candidate-1.webp',
      sha256: 'a'.repeat(64),
      bytes: 1024,
      mimeType: 'image/webp',
      width: 1536,
      height: 864,
      executor: { id: 'codex-imagegen' },
      createdAt: generatedAt,
    })).toThrow('candidate path must be owned by task')
  })

  it('rejects tampered cross-field task states', () => {
    const generated = generatedTask()
    const acceptedCandidate = {
      ...generated.candidates[0],
      status: 'accepted' as const,
      reviewedAt: '2026-08-13T08:02:00.000Z',
    }

    expect(() => validateAdvAssetGenerationTask({
      ...generated,
      candidates: [acceptedCandidate, { ...acceptedCandidate, id: 'candidate-2' }],
      status: 'accepted',
    })).toThrow('must not contain multiple accepted candidates')
    expect(() => validateAdvAssetGenerationTask({
      ...generated,
      candidates: [acceptedCandidate],
      status: 'registered',
    })).toThrow('must declare registration metadata')
    expect(() => validateAdvAssetGenerationTask({
      ...generated,
      candidates: [{ ...generated.candidates[0], reviewedAt: '2026-08-13T08:02:00.000Z' }],
    })).toThrow('must not contain review metadata')
  })
})
