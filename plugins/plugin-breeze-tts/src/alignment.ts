import type { AdvVoiceSynthesisProvider, VoiceAlignment } from '@advjs/types'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseVoiceAlignment } from '@advjs/audio'
import { projectFile } from './runtime'

export interface BreezeAlignmentOptions {
  python: string
  modelPath: string
  revision?: string
}

export function createBreezeAligner(options: BreezeAlignmentOptions): NonNullable<AdvVoiceSynthesisProvider['align']> {
  return async (request) => {
    request.signal?.throwIfAborted()
    const root = await realpath(request.root)
    const path = await projectFile(root, request.path)
    const bytes = await readFile(path)
    if (createHash('sha256').update(bytes).digest('hex') !== request.sha256)
      throw new Error('VOICE_ALIGNMENT_AUDIO_CHANGED')
    const language = new Intl.Locale(request.locale ?? 'zh-CN').language
    if (!['zh', 'en'].includes(language))
      throw new Error('VOICE_ALIGNMENT_LANGUAGE_UNSUPPORTED')
    const result = await new Promise<string>((yes, no) => {
      const child = spawn(options.python, [fileURLToPath(new URL('../python/align.py', import.meta.url))], { shell: false, env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let failed = false
      const timeout = setTimeout(() => child.kill('SIGTERM'), 180_000)
      const abort = () => child.kill('SIGTERM')
      request.signal?.addEventListener('abort', abort, { once: true })
      if (request.signal?.aborted)
        abort()
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
        if (stdout.length > 1024 * 1024) {
          failed = true
          child.kill('SIGTERM')
        }
      })
      child.stderr.resume()
      child.stdin.on('error', () => {})
      child.once('error', () => {
        failed = true
      })
      child.once('close', (code) => {
        clearTimeout(timeout)
        request.signal?.removeEventListener('abort', abort)
        if (failed || code !== 0 || request.signal?.aborted)
          no(request.signal?.reason ?? new Error('VOICE_ALIGNMENT_FAILED: Check the prepared local Python and aligner model'))
        else
          yes(stdout)
      })
      child.stdin.end(JSON.stringify({ path, text: request.text, sha256: request.sha256, durationSeconds: request.durationSeconds, language: language === 'zh' ? 'Chinese' : 'English', modelPath: options.modelPath, revision: options.revision }))
    })
    request.signal?.throwIfAborted()
    const alignment: VoiceAlignment = parseVoiceAlignment(JSON.parse(result), { text: request.text, sha256: request.sha256, durationSeconds: request.durationSeconds })
    if (createHash('sha256').update(await readFile(path)).digest('hex') !== request.sha256)
      throw new Error('VOICE_ALIGNMENT_AUDIO_CHANGED')
    return alignment
  }
}
