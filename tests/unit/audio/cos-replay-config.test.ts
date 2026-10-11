import { describe, expect, it } from 'vitest'
import { cosReplayPublicationFile, parseCosReplayReceipt } from '../../fixtures/audio/cos-replay-config'

const valid = { project: '/private/real-cos-native-project', publication: { manifestUrl: 'https://assets-123.cos.ap-shanghai.myqcloud.com/acceptance/manifest.json', revision: 'a'.repeat(64) } }

describe('real COS archived Qwen replay boundary', () => {
  it('does not start anything until an explicit publication receipt is supplied', () => {
    expect(cosReplayPublicationFile({})).toBeUndefined()
    expect(() => cosReplayPublicationFile({ ADVJS_COS_REPLAY_PUBLICATION: './publication.json' })).toThrow('COS_REPLAY_ABSOLUTE_RECEIPT_REQUIRED')
    expect(cosReplayPublicationFile({ ADVJS_COS_REPLAY_PUBLICATION: '/private/publication.json' })).toBe('/private/publication.json')
  })
  it('accepts an immutable public Shanghai COS manifest tied to an existing native project', () => {
    expect(parseCosReplayReceipt(valid)).toMatchObject(valid)
    expect(() => parseCosReplayReceipt({ ...valid, publication: { ...valid.publication, revision: '' } })).toThrow('COS_REPLAY_RECEIPT_INVALID')
  })
  it.each(['http://127.0.0.1:3347/manifest.json', 'https://assets.example.org/manifest.json', 'https://assets-123.cos.ap-shanghai.myqcloud.com/manifest.json?sign=private', 'https://user:private@assets-123.cos.ap-shanghai.myqcloud.com/manifest.json'])('rejects a mock, unrelated endpoint or signed URL: %s', (manifestUrl) => {
    expect(() => parseCosReplayReceipt({ ...valid, publication: { ...valid.publication, manifestUrl } })).toThrow('COS_REPLAY_REAL_PUBLIC_ENDPOINT_REQUIRED')
  })
})
