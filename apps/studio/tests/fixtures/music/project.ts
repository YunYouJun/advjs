import { Buffer } from 'node:buffer'

export const musicLineId = 'line_019d137e-7abc-7000-8000-00000000e101'
export const musicText = '这是明确采用原创背景音乐的章节。'
export const privateBrief = 'studio-music-private-brief-20261012'
export const privateLicense = 'studio-music-original-permission-20261012'
export const sourceUrl = 'https://example.org/music-source'
export const musicFiles = {
  'adv.config.json': JSON.stringify({ id: 'studio-music-workflow', format: 'flow', root: 'adv', entryChapterId: 'intro' }),
  'adv/settings/game.json': JSON.stringify({ title: '原创音乐闭环验收', locale: 'zh-CN', chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }], entryChapterId: 'intro' }),
  'adv/chapters/intro.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'intro', title: '音乐章节', startNodeId: 'speech', notes: { original: 'preserve' }, nodes: [{ id: 'speech', type: 'narration', lineId: musicLineId, text: musicText, next: 'end' }, { id: 'end', type: 'end' }] }),
  'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'studio-music-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }),
}

/** Original procedural PCM acceptance cue, not external AI music or TTS. */
export function originalMusicWav(frequency = 330): Buffer {
  const rate = 24000
  const samples = rate * 3
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++) {
    const envelope = Math.min(1, index / 600, (samples - index) / 600)
    const tone = 0.3 * Math.sin(2 * Math.PI * frequency * index / rate) + 0.08 * Math.sin(2 * Math.PI * frequency * 1.5 * index / rate)
    wav.writeInt16LE(Math.round(tone * envelope * 32767), 44 + index * 2)
  }
  return wav
}
