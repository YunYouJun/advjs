import type { AdvRuntimePlugin, RuntimeSaveRecord, RuntimeStorage } from '@advjs/core'
import type { AdvChapter, JsonObject } from '@advjs/types'
import type { Argv } from 'yargs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { validateRuntimeSaveRecord } from '@advjs/core'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { loadAdvConfig } from '../config'
import {
  compileRuntimeChapterFiles,
  createFileRuntimeStorage,
  discoverRuntimeChapterFiles,
  resolveConfiguredRuntimeChapterFiles,
  RuntimeCliPlayer,
} from '../runtime'
import { t } from './i18n'

const CHOICE_RE = /^(?:choose\s+)?(\d+)$/
const PLOT_SUMMARY_RE = /^plotSummary:(.*)$/m
const SLOT_NAME_RE = /^[\w-]{1,40}$/

interface RuntimeStores {
  sessions: RuntimeStorage
  slots: RuntimeStorage
}

let stores: RuntimeStores | undefined

function getStores(): RuntimeStores {
  stores ??= {
    sessions: createFileRuntimeStorage(join(homedir(), '.advjs', 'runtime-sessions')),
    slots: createFileRuntimeStorage(join(homedir(), '.advjs', 'runtime-save-slots')),
  }
  return stores
}

function metadataString(record: RuntimeSaveRecord, key: string): string | undefined {
  const value = record.metadata?.[key]
  return typeof value === 'string' ? value : undefined
}

function metadataNumber(record: RuntimeSaveRecord, key: string): number | undefined {
  const value = record.metadata?.[key]
  return typeof value === 'number' ? value : undefined
}

function formatCompilerFailure(diagnostics: Array<{
  code: string
  message: string
  source?: { file?: string, line?: number, column?: number }
}>): Error {
  const message = diagnostics.map((diagnostic) => {
    const source = diagnostic.source?.file
      ? `${diagnostic.source.file}${diagnostic.source.line ? `:${diagnostic.source.line}:${diagnostic.source.column ?? 1}` : ''}: `
      : ''
    return `${source}${diagnostic.code} ${diagnostic.message}`
  }).join('\n')
  return new Error(message || 'ADV_RUNTIME_COMPILE_FAILED: Program was not emitted')
}

function traceReporter(enabled: boolean) {
  return enabled
    ? (trace: unknown) => process.stderr.write(`${JSON.stringify(trace)}\n`)
    : undefined
}

function runtimePlugins(value: unknown): AdvRuntimePlugin[] {
  if (!Array.isArray(value))
    return []
  return value.filter((plugin): plugin is AdvRuntimePlugin => Boolean(
    plugin
    && typeof plugin === 'object'
    && typeof (plugin as AdvRuntimePlugin).name === 'string'
    && typeof (plugin as AdvRuntimePlugin).version === 'string',
  ))
}

async function loadPlayer(scriptPath: string, trace = false): Promise<RuntimeCliPlayer> {
  const absoluteScript = resolve(process.cwd(), scriptPath)
  let chapters = await discoverRuntimeChapterFiles(absoluteScript)
  let entryChapterId = chapters.find(chapter => chapter.paths.includes(absoluteScript))?.id

  const { config } = await loadAdvConfig({ userRoot: process.cwd() })
  const configuredChapters = config.gameConfig?.chapters as AdvChapter[] | undefined
  if (configuredChapters?.length) {
    const configured = resolveConfiguredRuntimeChapterFiles({
      cwd: process.cwd(),
      scriptPath: absoluteScript,
      chapters: configuredChapters,
    })
    if (configured.entryChapterId) {
      chapters = configured.chapters
      entryChapterId = configured.entryChapterId
    }
  }

  const result = await compileRuntimeChapterFiles({
    id: `adv-play:${chapters.map(chapter => chapter.id).join('+')}`,
    chapters,
    entryChapterId,
    requiredPlugins: config.gameConfig?.requiredPlugins,
  })
  if (!result.program)
    throw formatCompilerFailure(result.diagnostics)
  return new RuntimeCliPlayer({
    program: result.program,
    initialVariables: config.gameConfig?.variables,
    plugins: runtimePlugins(config.plugins),
    trace: traceReporter(trace),
  })
}

function createSessionRecord(
  sessionId: string,
  scriptPath: string,
  player: RuntimeCliPlayer,
  extraMetadata: JsonObject = {},
): RuntimeSaveRecord {
  return {
    id: sessionId,
    snapshot: player.snapshot(),
    metadata: {
      kind: 'session',
      scriptPath: resolve(process.cwd(), scriptPath),
      ...extraMetadata,
    },
    updatedAt: Date.now(),
  }
}

async function persistSession(
  sessionId: string,
  scriptPath: string,
  player: RuntimeCliPlayer,
): Promise<RuntimeSaveRecord> {
  const record = createSessionRecord(sessionId, scriptPath, player)
  await getStores().sessions.set(record)
  return record
}

async function resumeSession(sessionId: string, trace = false): Promise<{
  player: RuntimeCliPlayer
  record: RuntimeSaveRecord
  scriptPath: string
} | undefined> {
  const record = await getStores().sessions.get(sessionId)
  if (!record)
    return undefined
  const scriptPath = metadataString(record, 'scriptPath')
  if (!scriptPath)
    throw new Error(`ADV_RUNTIME_INVALID_SAVE_RECORD: Session ${sessionId} has no scriptPath metadata`)
  const player = await loadPlayer(scriptPath, trace)
  player.restore(record.snapshot)
  return { player, record, scriptPath }
}

function stagePrefix(player: RuntimeCliPlayer): string {
  const stage = player.status().stage
  const parts = [
    stage.background ? `[BG ${stage.background}]` : '',
    stage.bgm ? `[BGM ${stage.bgm}]` : '',
    ...Object.entries(stage.tachies).map(([name, tachie]) => (
      tachie.status ? `[${name}:${tachie.status}]` : `[${name}]`
    )),
  ].filter(Boolean)
  return parts.length ? `${parts.join(' ')}\n` : ''
}

function formatPlayerOutput(player: RuntimeCliPlayer): string {
  const current = player.current()
  const stage = stagePrefix(player)
  if (current.type === 'dialog')
    return `${stage}${current.character}${current.status ? `(${current.status})` : ''}: ${current.text ?? ''}`
  if (current.type === 'narration')
    return `${stage}  "${current.text ?? ''}"`
  if (current.type === 'choices') {
    const options = current.options?.map(option => `  ${option.index}. ${option.label}`).join('\n') ?? ''
    return `${stage}${options}`
  }
  if (current.type === 'end')
    return `${stage}\n— END —\n`
  return `${stage}${current.text ?? ''}`
}

function outputPlayer(player: RuntimeCliPlayer, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({
      state: player.status(),
      current: player.current(),
    }, null, 2))
  }
  else {
    console.log(formatPlayerOutput(player))
  }
}

function printFramedPlayer(player: RuntimeCliPlayer): void {
  console.log()
  console.log(colors.dim('━'.repeat(50)))
  console.log(formatPlayerOutput(player))
  console.log(colors.dim('━'.repeat(50)))
}

function extractChapterTitle(scriptPath: string, content: string): string {
  const match = content.match(PLOT_SUMMARY_RE)
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') || basename(scriptPath, '.adv.md')
}

async function interactivePlay(
  scriptPath: string,
  sessionId?: string,
  trace = false,
): Promise<void> {
  const absoluteScript = resolve(process.cwd(), scriptPath)
  const id = sessionId || `play-${Date.now()}`
  const resumed = sessionId ? await resumeSession(sessionId, trace) : undefined
  const player = resumed?.player ?? await loadPlayer(absoluteScript, trace)
  if (!resumed) {
    await player.start()
    await persistSession(id, absoluteScript, player)
  }
  printFramedPlayer(player)

  if (player.status().status === 'ended') {
    consola.info(t('play.story_ended'))
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>((done) => {
    rl.once('close', done)
    const prompt = () => {
      const waiting = player.status().status === 'waiting-choice'
      const waitingActivity = player.status().status === 'waiting-activity'
      const hint = waitingActivity
        ? colors.yellow('activity <json>')
        : (waiting ? colors.yellow(t('play.hint_choose')) : colors.dim(t('play.hint_next')))
      rl.question(`\n${colors.dim('>')} (${hint}): `, async (input) => {
        const trimmed = input.trim().toLowerCase()
        if (trimmed === 'quit' || trimmed === 'q' || trimmed === 'exit') {
          rl.close()
          return
        }
        if (trimmed === 'status') {
          console.log(JSON.stringify(player.status(), null, 2))
          prompt()
          return
        }
        if (trimmed === 'reset') {
          await getStores().sessions.remove(id)
          consola.success(t('play.session_reset'))
          rl.close()
          return
        }

        try {
          const choice = CHOICE_RE.exec(trimmed)
          if (waitingActivity) {
            const rawResult = input.trim().replace(/^activity\s+/i, '')
            await player.completeActivity(JSON.parse(rawResult))
          }
          else if (choice && waiting) {
            await player.choose(Number.parseInt(choice[1]))
          }
          else {
            await player.next()
          }
          await persistSession(id, absoluteScript, player)
          printFramedPlayer(player)
        }
        catch (error) {
          consola.error(error instanceof Error ? error.message : String(error))
        }

        if (player.status().status === 'ended') {
          consola.info(t('play.story_ended'))
          rl.close()
        }
        else {
          prompt()
        }
      })
    }
    prompt()
  })
}

function missingSession(sessionId: string): void {
  consola.error(t('play.session_not_found', sessionId))
  process.exitCode = 1
}

export function installPlayCommand(cli: Argv) {
  cli.command('play [script]', t('play.desc'), (yargs) => {
    return yargs
      .positional('script', { type: 'string', describe: t('play.script_desc') })
      .option('session-id', { type: 'string', describe: t('play.session_id_desc') })
      .option('root', { type: 'string', describe: t('play.root_desc') })
      .option('json', { type: 'boolean', default: false, describe: t('play.json_desc') })
      .option('trace', { type: 'boolean', default: false })
      .command('next', t('play.next_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const resumed = await resumeSession(sessionId, argv.trace as boolean)
        if (!resumed) {
          missingSession(sessionId)
          return
        }
        await resumed.player.next()
        await persistSession(sessionId, resumed.scriptPath, resumed.player)
        outputPlayer(resumed.player, argv.json as boolean)
      })
      .command('choose <number>', t('play.choose_desc'), y => y
        .positional('number', { type: 'number', demandOption: true })
        .option('session-id', { type: 'string', demandOption: true })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const resumed = await resumeSession(sessionId, argv.trace as boolean)
        if (!resumed) {
          missingSession(sessionId)
          return
        }
        await resumed.player.choose(argv.number as number)
        await persistSession(sessionId, resumed.scriptPath, resumed.player)
        outputPlayer(resumed.player, argv.json as boolean)
      })
      .command('activity <result>', 'Complete the pending activity with a JSON result', y => y
        .positional('result', { type: 'string', demandOption: true })
        .option('session-id', { type: 'string', demandOption: true })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const resumed = await resumeSession(sessionId, argv.trace as boolean)
        if (!resumed) {
          missingSession(sessionId)
          return
        }
        await resumed.player.completeActivity(JSON.parse(argv.result as string))
        await persistSession(sessionId, resumed.scriptPath, resumed.player)
        outputPlayer(resumed.player, argv.json as boolean)
      })
      .command('back', t('play.back_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true })
        .option('steps', { type: 'number', default: 1 })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const resumed = await resumeSession(sessionId, argv.trace as boolean)
        if (!resumed) {
          missingSession(sessionId)
          return
        }
        const result = resumed.player.back(argv.steps as number)
        await persistSession(sessionId, resumed.scriptPath, resumed.player)
        if (argv.json) {
          console.log(JSON.stringify({
            sessionId,
            requestedSteps: argv.steps,
            poppedSteps: result.poppedSteps,
            current: result.current,
          }, null, 2))
        }
        else {
          consola.info(result.poppedSteps ? t('play.back_done', result.poppedSteps) : t('play.back_no_history'))
          outputPlayer(resumed.player, false)
        }
      })
      .command('status', t('play.status_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const resumed = await resumeSession(sessionId, argv.trace as boolean)
        if (!resumed) {
          missingSession(sessionId)
          return
        }
        if (argv.json)
          outputPlayer(resumed.player, true)
        else
          consola.info(t('play.session_status'), resumed.player.status())
      })
      .command('save', t('play.save_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true })
        .option('output', { alias: 'o', type: 'string' })
        .option('slot', { type: 'string' })
        .option('note', { type: 'string' })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const resumed = await resumeSession(sessionId, argv.trace as boolean)
        if (!resumed) {
          missingSession(sessionId)
          return
        }

        const slot = argv.slot as string | undefined
        if (slot) {
          if (!SLOT_NAME_RE.test(slot))
            throw new Error(`Invalid slot name: ${slot}`)
          const content = await readFile(resumed.scriptPath, 'utf8')
          const current = resumed.player.current()
          const metadata: JsonObject = {
            kind: 'slot',
            sessionId,
            slot,
            scriptPath: resumed.scriptPath,
            chapterTitle: extractChapterTitle(resumed.scriptPath, content),
            address: `${current.address.chapterId}#${current.address.nodeId}`,
            visitedCount: resumed.player.status().visited.length,
          }
          if (current.text)
            metadata.previewText = current.text.slice(0, 80)
          if (argv.note)
            metadata.note = argv.note as string
          const record: RuntimeSaveRecord = {
            id: `${sessionId}:${slot}`,
            snapshot: resumed.player.snapshot(),
            metadata,
            updatedAt: Date.now(),
          }
          await getStores().slots.set(record)
          if (argv.json)
            console.log(JSON.stringify(record, null, 2))
          else
            consola.success(t('play.slot_saved', slot, sessionId))
          return
        }

        const record = createSessionRecord(sessionId, resumed.scriptPath, resumed.player)
        const outputPath = argv.output as string | undefined
        if (outputPath) {
          await writeFile(resolve(process.cwd(), outputPath), `${JSON.stringify(record, null, 2)}\n`, 'utf8')
          if (argv.json)
            console.log(JSON.stringify({ sessionId, output: outputPath }, null, 2))
          else
            consola.success(t('play.session_saved', outputPath))
        }
        else {
          console.log(JSON.stringify(record, null, 2))
        }
      })
      .command('load [file]', t('play.load_desc'), y => y
        .positional('file', { type: 'string' })
        .option('session-id', { type: 'string' })
        .option('slot', { type: 'string' })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const slot = argv.slot as string | undefined
        const requestedSessionId = argv.sessionId as string | undefined
        let record: RuntimeSaveRecord | undefined
        if (slot) {
          if (!requestedSessionId) {
            consola.error(t('play.load_slot_needs_session'))
            process.exitCode = 1
            return
          }
          record = await getStores().slots.get(`${requestedSessionId}:${slot}`)
          if (!record) {
            consola.error(t('play.slot_not_found', slot, requestedSessionId))
            process.exitCode = 1
            return
          }
        }
        else {
          const file = argv.file as string | undefined
          if (!file) {
            consola.error(t('play.load_needs_file_or_slot'))
            process.exitCode = 1
            return
          }
          record = validateRuntimeSaveRecord(JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8')))
        }

        const scriptPath = metadataString(record, 'scriptPath')
        if (!scriptPath)
          throw new Error('ADV_RUNTIME_INVALID_SAVE_RECORD: Missing scriptPath metadata')
        const player = await loadPlayer(scriptPath, argv.trace as boolean)
        player.restore(record.snapshot)
        const sessionId = requestedSessionId || metadataString(record, 'sessionId') || record.id
        await persistSession(sessionId, scriptPath, player)
        if (argv.json) {
          console.log(JSON.stringify({ sessionId, state: player.status(), current: player.current() }, null, 2))
        }
        else {
          consola.success(slot ? t('play.slot_loaded', slot, sessionId) : t('play.session_loaded', sessionId))
          outputPlayer(player, false)
        }
      })
      .command('saves', t('play.saves_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const slots = (await getStores().slots.list())
          .filter(record => metadataString(record, 'sessionId') === sessionId)
        if (argv.json) {
          console.log(JSON.stringify(slots, null, 2))
        }
        else if (!slots.length) {
          consola.info(t('play.no_saves', sessionId))
        }
        else {
          consola.info(t('play.saves_for', sessionId))
          for (const record of slots) {
            const created = new Date(record.updatedAt).toISOString()
            const slotName = metadataString(record, 'slot') ?? record.id
            const title = metadataString(record, 'chapterTitle') ?? ''
            const address = metadataString(record, 'address') ?? ''
            const visited = metadataNumber(record, 'visitedCount') ?? 0
            const note = metadataString(record, 'note')
            console.log(`  • ${colors.cyan(slotName)} ${colors.dim(`(${created})`)} ${title} ${address} [visited ${visited}]${note ? colors.dim(` — ${note}`) : ''}`)
          }
        }
      })
      .command('delete-save', t('play.delete_save_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true })
        .option('slot', { type: 'string', demandOption: true })
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessionId = argv.sessionId as string
        const slot = argv.slot as string
        const id = `${sessionId}:${slot}`
        const removed = Boolean(await getStores().slots.get(id))
        await getStores().slots.remove(id)
        if (argv.json)
          console.log(JSON.stringify({ sessionId, slot, removed }, null, 2))
        else if (removed)
          consola.success(t('play.slot_deleted', slot, sessionId))
        else
          consola.warn(t('play.slot_not_found', slot, sessionId))
      })
      .command('list', t('play.list_desc'), y => y
        .option('json', { type: 'boolean', default: false }), async (argv) => {
        const sessions = await getStores().sessions.list()
        if (argv.json) {
          console.log(JSON.stringify(sessions, null, 2))
        }
        else if (!sessions.length) {
          consola.info(t('play.no_sessions'))
        }
        else {
          consola.info(t('play.active_sessions'))
          sessions.forEach(record => console.log(`  - ${record.id}`))
        }
      })
      .command('reset', t('play.reset_desc'), y => y
        .option('session-id', { type: 'string', demandOption: true }), async (argv) => {
        await getStores().sessions.remove(argv.sessionId as string)
        consola.success(t('play.session_reset_id', argv.sessionId as string))
      })
  }, async (argv) => {
    if (argv.script) {
      await interactivePlay(
        argv.script as string,
        argv.sessionId as string | undefined,
        argv.trace as boolean,
      )
    }
    else {
      consola.error(`${t('play.no_script_prefix')} ${colors.cyan('adv play')} ${colors.dim('<script.adv.md>')}`)
      process.exitCode = 1
    }
  })
}
