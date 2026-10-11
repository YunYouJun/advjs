import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { processProjectAudio, runAudioProcess } from '../../../packages/advjs/node/audio/process'

async function generateAudioVariants() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-encoded-fixtures-'))
  try {
    await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=280:duration=2', '-ar', '48000', join(root, 'master.wav')])
    const receipt = await processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'processed', kind: 'voice' })
    const destination = fileURLToPath(new URL('./public/variants/', import.meta.url))
    await mkdir(destination, { recursive: true })
    for (const output of receipt.outputs)
      await copyFile(join(root, output.path), join(destination, `voice.${output.variant === 'opus' ? 'webm' : 'm4a'}`))
    await writeFile(join(destination, 'receipt.json'), `${JSON.stringify({ ...receipt, outputs: receipt.outputs.map(output => ({ ...output, path: `voice.${output.variant === 'opus' ? 'webm' : 'm4a'}` })) }, null, 2)}\n`)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

void generateAudioVariants()
