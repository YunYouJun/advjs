import type { AdvCharacter } from '@advjs/types'
import type { Argv } from 'yargs'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { AdvPlayEngine, formatAsText } from '@advjs/core'
import { parseCharacterMd } from '@advjs/parser'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { resolveGameRoot } from '../commands/utils'
import { t } from './i18n'

const CHOICE_RE = /^(?:choose\s+)?(\d+)$/
const PLOT_SUMMARY_RE = /^plotSummary:(.*)$/m

let engine: AdvPlayEngine | null = null

/**
 * Build a character lookup from the resolved game root so the engine can
 * enrich tachie state with `appearance` from `.character.md`.
 */
function loadCharacterDirectory(gameRoot: string): Map<string, AdvCharacter> {
  const dir = join(gameRoot, 'characters')
  const map = new Map<string, AdvCharacter>()
  if (!existsSync(dir))
    return map
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.character.md'))
      continue
    try {
      const character = parseCharacterMd(readFileSync(join(dir, file), 'utf-8'))
      // index by id, name, and aliases
      map.set(character.id, character)
      map.set(character.name, character)
      for (const alias of character.aliases ?? [])
        map.set(alias, character)
    }
    catch {
      // skip invalid character files — `adv check` will surface them
    }
  }
  return map
}

function getEngine(opts?: { sessionDir?: string, root?: string }): AdvPlayEngine {
  if (!engine) {
    engine = new AdvPlayEngine(opts?.sessionDir)
    const gameRoot = resolveGameRoot(process.cwd(), opts?.root)
    if (existsSync(gameRoot)) {
      const characters = loadCharacterDirectory(gameRoot)
      engine.setHooks({
        getCharacterMeta: (name) => {
          const char = characters.get(name)
          if (!char)
            return undefined
          return char.appearance ? { appearance: char.appearance } : {}
        },
      })
    }
  }
  return engine
}

function output(data: unknown, json: boolean) {
  if (json)
    console.log(JSON.stringify(data, null, 2))
  else if (data && typeof data === 'object' && 'type' in data)
    console.log(formatAsText(data as any))
}

function printSnapshot(snapshot: unknown, json: boolean) {
  // snapshot is JSON either way; `json` flag kept for symmetry.
  void json
  console.log(JSON.stringify(snapshot, null, 2))
}

/**
 * Best-effort chapter title from script frontmatter (`plotSummary` field).
 */
function extractChapterTitle(scriptPath: string): string | undefined {
  try {
    const content = readFileSync(scriptPath, 'utf-8')
    const match = content.match(PLOT_SUMMARY_RE)
    if (match)
      return match[1].trim().replace(/^['"]|['"]$/g, '')
  }
  catch {
    // missing or unreadable script — chapter title is best-effort only
  }
  return basename(scriptPath, '.adv.md')
}

/**
 * Interactive play mode - reads stdin for next/choose commands
 */
async function interactivePlay(scriptPath: string, sessionId?: string, root?: string) {
  const absPath = resolve(process.cwd(), scriptPath)
  const content = await readFile(absPath, 'utf-8')
  const eng = getEngine({ root })

  const result = await eng.loadScript(content, absPath, sessionId)
  if (result) {
    console.log()
    console.log(colors.dim('━'.repeat(50)))
    console.log(formatAsText(result))
    console.log(colors.dim('━'.repeat(50)))
  }

  if (eng.isEnd()) {
    consola.info(t('play.story_ended'))
    return
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const prompt = () => {
    const status = eng.getStatus()
    const hint = status.status === 'waiting_choice'
      ? colors.yellow(t('play.hint_choose'))
      : colors.dim(t('play.hint_next'))

    rl.question(`\n${colors.dim('>')} (${hint}): `, async (input) => {
      const trimmed = input.trim().toLowerCase()

      if (trimmed === 'quit' || trimmed === 'q' || trimmed === 'exit') {
        rl.close()
        return
      }

      if (trimmed === 'status') {
        console.log(JSON.stringify(eng.getStatus(), null, 2))
        prompt()
        return
      }

      if (trimmed === 'reset') {
        await eng.reset()
        consola.success(t('play.session_reset'))
        rl.close()
        return
      }

      let result
      const choiceMatch = CHOICE_RE.exec(trimmed)
      if (choiceMatch && status.status === 'waiting_choice') {
        result = await eng.choose(Number.parseInt(choiceMatch[1]))
      }
      else {
        result = await eng.next()
      }

      if (result) {
        console.log()
        console.log(colors.dim('━'.repeat(50)))
        console.log(formatAsText(result))
        console.log(colors.dim('━'.repeat(50)))
      }

      if (eng.isEnd()) {
        consola.info(t('play.story_ended'))
        rl.close()
        return
      }

      prompt()
    })
  }

  prompt()
}

export function installPlayCommand(cli: Argv) {
  cli.command('play [script]', t('play.desc'), (yargs) => {
    return yargs
      .positional('script', {
        type: 'string',
        describe: t('play.script_desc'),
      })
      .option('session-id', {
        type: 'string',
        describe: t('play.session_id_desc'),
      })
      .option('root', {
        type: 'string',
        describe: t('play.root_desc'),
      })
      .option('json', {
        type: 'boolean',
        default: false,
        describe: t('play.json_desc'),
      })
      .command('next', t('play.next_desc'), (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
          .option('root', { type: 'string', describe: t('play.root_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine({ root: argv.root as string | undefined })
        const result = await eng.resumeSession(argv.sessionId as string)
        if (!result) {
          consola.error(t('play.session_not_found', argv.sessionId as string))
          process.exit(1)
        }
        const next = await eng.next()
        output(next, argv.json as boolean)
      })
      .command('choose <number>', t('play.choose_desc'), (yargs) => {
        return yargs
          .positional('number', { type: 'number', demandOption: true, describe: t('play.choice_number_desc') })
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
          .option('root', { type: 'string', describe: t('play.root_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine({ root: argv.root as string | undefined })
        const result = await eng.resumeSession(argv.sessionId as string)
        if (!result) {
          consola.error(t('play.session_not_found', argv.sessionId as string))
          process.exit(1)
        }
        const choice = await eng.choose(argv.number as number)
        output(choice, argv.json as boolean)
      })
      .command('status', t('play.status_desc'), (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
          .option('root', { type: 'string', describe: t('play.root_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine({ root: argv.root as string | undefined })
        const result = await eng.resumeSession(argv.sessionId as string)
        if (!result) {
          consola.error(t('play.session_not_found', argv.sessionId as string))
          process.exit(1)
        }
        const status = eng.getStatus()
        if (argv.json)
          console.log(JSON.stringify(status, null, 2))
        else
          consola.info(t('play.session_status'), status)
      })
      .command('save', t('play.save_desc'), (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
          .option('output', { alias: 'o', type: 'string', describe: t('play.save_output_desc') })
          .option('slot', { type: 'string', describe: t('play.save_slot_desc') })
          .option('note', { type: 'string', describe: t('play.save_note_desc') })
          .option('root', { type: 'string', describe: t('play.root_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine({ root: argv.root as string | undefined })
        const sessionId = argv.sessionId as string
        const slot = argv.slot as string | undefined
        const json = argv.json as boolean

        // Slot mode: persist a named save with metadata
        if (slot) {
          const resumed = await eng.resumeSession(sessionId)
          if (!resumed) {
            consola.error(t('play.session_not_found', sessionId))
            process.exit(1)
          }
          const status = eng.getStatus()
          const session = (await eng.getSessionManager().get(sessionId))!
          const meta = await eng.getSessionManager().saveSlot(sessionId, slot, {
            scriptPath: session.scriptPath,
            currentIndex: session.currentIndex,
            totalNodes: status.totalNodes as number,
            chapterTitle: extractChapterTitle(session.scriptPath),
            previewText: eng.getCurrentPreviewText(),
            note: argv.note as string | undefined,
          })
          if (json)
            console.log(JSON.stringify(meta, null, 2))
          else
            consola.success(t('play.slot_saved', slot, sessionId))
          return
        }

        const snapshot = await eng.getSessionManager().exportSnapshot(sessionId)
        if (!snapshot) {
          consola.error(t('play.session_not_found', sessionId))
          process.exit(1)
        }

        const outputPath = argv.output as string | undefined
        if (outputPath) {
          await writeFile(resolve(process.cwd(), outputPath), JSON.stringify(snapshot, null, 2), 'utf-8')
          if (json)
            console.log(JSON.stringify({ sessionId: snapshot.session.id, output: outputPath }, null, 2))
          else
            consola.success(t('play.session_saved', outputPath))
        }
        else {
          printSnapshot(snapshot, json)
        }
      })
      .command('load [file]', t('play.load_desc'), (yargs) => {
        return yargs
          .positional('file', { type: 'string', describe: t('play.load_file_desc') })
          .option('session-id', { type: 'string', describe: t('play.session_id_desc') })
          .option('slot', { type: 'string', describe: t('play.load_slot_desc') })
          .option('root', { type: 'string', describe: t('play.root_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine({ root: argv.root as string | undefined })
        const slot = argv.slot as string | undefined
        const sessionId = argv.sessionId as string | undefined
        const file = argv.file as string | undefined
        const json = argv.json as boolean

        // Slot mode requires both --slot and the source --session-id
        if (slot) {
          if (!sessionId) {
            consola.error(t('play.load_slot_needs_session'))
            process.exit(1)
          }
          const entry = await eng.getSessionManager().loadSlot(sessionId, slot)
          if (!entry) {
            consola.error(t('play.slot_not_found', slot, sessionId))
            process.exit(1)
          }
          const session = await eng.getSessionManager().importSnapshot(entry.snapshot, sessionId)
          const resumed = await eng.resumeSession(session.id)
          if (json) {
            console.log(JSON.stringify({
              sessionId: session.id,
              slot,
              meta: entry.meta,
              status: eng.getStatus(),
              current: resumed,
            }, null, 2))
          }
          else {
            consola.success(t('play.slot_loaded', slot, session.id))
            if (resumed)
              console.log(formatAsText(resumed))
          }
          return
        }

        if (!file) {
          consola.error(t('play.load_needs_file_or_slot'))
          process.exit(1)
        }

        const filePath = resolve(process.cwd(), file)
        const raw = await readFile(filePath, 'utf-8')
        const snapshot = JSON.parse(raw)
        const session = await eng.getSessionManager().importSnapshot(snapshot, sessionId)
        const resumed = await eng.resumeSession(session.id)
        if (json) {
          console.log(JSON.stringify({
            sessionId: session.id,
            status: eng.getStatus(),
            current: resumed,
          }, null, 2))
        }
        else {
          consola.success(t('play.session_loaded', session.id))
          if (resumed)
            console.log(formatAsText(resumed))
        }
      })
      .command('saves', t('play.saves_desc'), (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const sessionId = argv.sessionId as string
        const slots = await eng.getSessionManager().listSlots(sessionId)
        if (argv.json) {
          console.log(JSON.stringify(slots, null, 2))
        }
        else if (slots.length === 0) {
          consola.info(t('play.no_saves', sessionId))
        }
        else {
          consola.info(t('play.saves_for', sessionId))
          for (const meta of slots) {
            const created = new Date(meta.createdAt).toISOString()
            const note = meta.note ? colors.dim(` — ${meta.note}`) : ''
            const preview = meta.previewText ? colors.dim(` "${meta.previewText}"`) : ''
            console.log(`  • ${colors.cyan(meta.slot)} ${colors.dim(`(${created})`)} ${meta.chapterTitle ?? ''} [${meta.currentIndex}/${meta.totalNodes}]${note}${preview}`)
          }
        }
      })
      .command('delete-save', t('play.delete_save_desc'), (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
          .option('slot', { type: 'string', demandOption: true, describe: t('play.save_slot_desc') })
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const sessionId = argv.sessionId as string
        const slot = argv.slot as string
        const removed = await eng.getSessionManager().deleteSlot(sessionId, slot)
        if (argv.json) {
          console.log(JSON.stringify({ sessionId, slot, removed }, null, 2))
        }
        else if (removed) {
          consola.success(t('play.slot_deleted', slot, sessionId))
        }
        else {
          consola.warn(t('play.slot_not_found', slot, sessionId))
        }
      })
      .command('list', t('play.list_desc'), (yargs) => {
        return yargs
          .option('json', { type: 'boolean', default: false })
      }, async (argv) => {
        const eng = getEngine()
        const sessions = await eng.getSessionManager().list()
        if (argv.json) {
          console.log(JSON.stringify(sessions, null, 2))
        }
        else {
          if (sessions.length === 0) {
            consola.info(t('play.no_sessions'))
          }
          else {
            consola.info(t('play.active_sessions'))
            sessions.forEach(s => console.log(`  - ${s}`))
          }
        }
      })
      .command('reset', t('play.reset_desc'), (yargs) => {
        return yargs
          .option('session-id', { type: 'string', demandOption: true, describe: t('play.session_id_desc') })
      }, async (argv) => {
        const eng = getEngine()
        await eng.getSessionManager().delete(argv.sessionId as string)
        consola.success(t('play.session_reset_id', argv.sessionId as string))
      })
  }, async (argv) => {
    // Default: interactive play mode
    if (argv.script) {
      await interactivePlay(argv.script as string, argv.sessionId as string | undefined, argv.root as string | undefined)
    }
    else {
      consola.error(`${t('play.no_script_prefix')} ${colors.cyan('adv play')} ${colors.dim('<script.adv.md>')}`)
      process.exit(1)
    }
  })
}
