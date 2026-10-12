import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProject } from 'advjs/node'

function toneWav() {
  const rate = 24000
  const frames = rate
  const wav = Buffer.alloc(44 + frames * 2)
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
  wav.writeUInt32LE(frames * 2, 40)
  for (let frame = 0; frame < frames; frame++)
    wav.writeInt16LE(Math.round(Math.sin(frame / rate * Math.PI * 2 * 330) * 6000), 44 + frame * 2)
  return wav
}

/** Offline fixture imports exact existing media; it never sets up or invokes a provider. */
export async function createEditorListeningFixture(options: { directory?: string, archivedCalls?: string } = {}) {
  const directory = options.directory ?? tmpdir()
  await mkdir(directory, { recursive: true })
  const root = await mkdtemp(join(directory, 'native-editor-listening-'))
  const archived = options.archivedCalls ? JSON.parse(await readFile(options.archivedCalls, 'utf8')).calls as Array<{ host: string, purpose: string, model: string, revision: string, generationMode: string, engine: string, engineVersion: string, provider: string, wav: { source: string, sha256: string, bytes: number, durationSeconds: number }, manifest: { source: string, sha256: string } }> : undefined
  if (archived && archived.length !== 8)
    throw new Error('Expected the finite eight-call archived cohort')
  const assets = []
  const ledgerLines: Record<string, unknown> = {}
  const lines: Array<{ id: string, text: string }> = []
  const sourceProof = []
  for (let group = 0; group < 4; group++) {
    const lineId = `line_019d137e-7abc-7000-8000-00000000a00${group + 1}`
    const host = group < 2 ? 'editor' : 'studio'
    const purpose = group % 2 ? 'dialogue' : 'audition'
    const takes = []
    let text = group % 2 ? '你好，我们一起出发吧。' : '你好，这是原创音频，用于测试听审界面。'
    for (let candidate = 0; candidate < 2; candidate++) {
      const original = archived?.find(call => call.host === host && call.purpose === `${candidate ? 'base' : 'design'}-${purpose}`)
      const bytes = original ? await readFile(original.wav.source) : toneWav()
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      let originalText = text
      if (original) {
        if (bytes.length !== original.wav.bytes || sha256 !== original.wav.sha256)
          throw new Error('Archived Qwen WAV changed; refusal before UI startup')
        const manifest = await readFile(original.manifest.source)
        if (createHash('sha256').update(manifest).digest('hex') !== original.manifest.sha256)
          throw new Error('Archived Qwen provider manifest changed')
        originalText = String(JSON.parse(manifest.toString('utf8')).samples[0].text)
      }
      if (candidate && text !== originalText)
        throw new Error('Archived pair has different actual spoken text')
      text = originalText
      const suffix = String(group * 2 + candidate + 1).padStart(3, '0')
      const assetId = `audio_019d137e-7abc-7000-8000-00000000b${suffix}`
      const takeId = `take_019d137e-7abc-7000-8000-00000000c${suffix}`
      const path = `voice/listening-${suffix}.wav`
      const asset = { id: assetId, kind: 'voice', type: 'audio', path, title: `听审候选 ${suffix}`, sha256, bytes: bytes.length, duration: original?.wav.durationSeconds ?? 1, mimeType: 'audio/wav' }
      assets.push(asset)
      takes.push({ id: takeId, assetId, sha256, providerId: original ? 'archived-qwen-import-fixture' : 'offline-tone-fixture', voiceId: `recorded:${suffix}`, model: original ? 'archived-audio-import-fixture' : 'fixture-tone', voiceProfileRevision: sha256, inputFingerprint: sha256, spokenText: text, createdAt: `2026-10-11T08:0${candidate}:00.000Z`, source: 'recorded', parameters: { importedFixtureBinding: true } })
      await mkdir(join(root, 'public/media/voice'), { recursive: true })
      await writeFile(join(root, 'public/media', path), bytes)
      sourceProof.push({ host, purpose: `${candidate ? 'base' : 'design'}-${purpose}`, assetId, takeId, lineId, sha256, bytes: bytes.length, originalSource: original?.wav.source ?? null, originalProvider: original?.provider ?? null, originalModel: original?.model ?? null, originalModelRevision: original?.revision ?? null, originalGenerationMode: original?.generationMode ?? null, originalEngine: original?.engine ?? null, originalEngineVersion: original?.engineVersion ?? null, originalProviderManifestSha256: original?.manifest.sha256 ?? null, importedFixtureBinding: true, takeIdProfileAndFingerprintAreTestBindings: true })
    }
    lines.push({ id: lineId, text })
    ledgerLines[lineId] = { speakerId: 'narrator', displayText: text, locales: { 'zh-CN': { selectedTake: takes[0]!.id, takes } } }
  }
  const files = {
    'adv.config.json': JSON.stringify({ schemaVersion: 1, id: 'voice-listening-acceptance', root: 'adv', format: 'flow' }),
    'adv/settings/game.json': JSON.stringify({ title: '听审集成 · Listening integration', locale: 'zh-CN', characters: [], entryChapterId: 'intro', chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }] }),
    'adv/chapters/intro.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Listening source', startNodeId: 'line-0', nodes: [...lines.map((line, index) => ({ id: `line-${index}`, type: 'narration', text: line.text, lineId: line.id, next: index === lines.length - 1 ? 'end' : `line-${index + 1}` })), { id: 'end', type: 'end', next: null }] }),
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'voice-listening-acceptance-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets }),
    'adv/audio/voice-ledger.json': JSON.stringify({ schemaVersion: 1, lines: ledgerLines }),
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), content)
  }
  const loaded = await loadProject({ root })
  const compiledLines = Object.values(loaded.result.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).filter(node => ['dialog', 'narration'].includes(node.kind)).map(node => ({ lineId: node.data?.lineId, text: node.data?.text }))
  if (loaded.result.diagnostics.some(item => item.severity === 'error') || compiledLines.length !== 4 || !lines.every(line => compiledLines.some(node => node.lineId === line.id && node.text === line.text)))
    throw new Error('Listening fixture must compile four actual source lines matching native ledger identities')
  return { root, lines, assets, sourceProof, files, chapterPath: 'adv/chapters/intro.chapter.json', compiledLines, newTtsCalls: 0, cloudWrites: 0 }
}
