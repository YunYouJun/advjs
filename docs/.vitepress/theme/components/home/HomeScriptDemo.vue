<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import advPalette from '../../../../../packages/parser/syntaxes/adv.palette.json'
import { aiModeKey, createAiMode } from '../../composables/ai-mode'
import { prefersReducedMotion, useHomeCopy, useInView } from '../../composables/home'
import { playerKey, useStoryPlayer } from '../../composables/player'
import { useHomeSkin } from '../../composables/skin'
import { skinComponents } from './data/skin-components'
import { stories } from './data/skins'
import { data as sourceTokens } from './data/stories.data'
import HomeRich from './HomeRich.vue'
import HomeSkinSwitcher from './HomeSkinSwitcher.vue'
import HomeTransitionCue from './HomeTransitionCue.vue'

interface Token {
  text: string
  kind?: string
}

const HomeAiSettings = defineAsyncComponent(() => import('./ai/HomeAiSettings.vue'))

const t = useHomeCopy()
const { skin } = useHomeSkin()

// AI mode (tram only): the generated run replaces the hand-written story once it has compiled.
const ai = createAiMode(t.value.locale === 'en' ? 'en' : 'zh')
provide(aiModeKey, ai)
const aiRun = computed(() => skin.value === 'tram' && ai.on.value ? ai.run.value : undefined)
const story = computed(() => aiRun.value?.story.value ?? stories[skin.value])
/** The file the model is writing, shown in the explorer as it streams. */
const aiWriting = computed(() => aiRun.value?.writing.value)
watch(skin, (next) => {
  if (next !== 'tram' && ai.on.value)
    ai.leave()
})
onBeforeUnmount(() => ai.leave())

// The pane is always a night panel, so it takes the dark side of the shared ADV palette.
const paletteVars = Object.fromEntries(
  Object.entries(advPalette.palettes.dark).map(([role, color]) => [`--adv-${role}`, color]),
)

// Player
const playerEl = ref<HTMLElement>()
// Watch the stage, not the section: stacked on narrow screens, the section is taller than the viewport.
const inView = useInView(playerEl, 0.35)
const tab = ref<'stage' | 'json'>('stage')
const player = useStoryPlayer(story, computed(() => inView.value && tab.value === 'stage'))
const { currentId, chapterId, current, variables, file: playingFile, lines: litLines, jump } = player
provide(playerKey, player)
ai.attach(player)

// Project explorer: the story's files as a tree, and the open file, which follows the playhead
// from file to file and chapter to chapter until someone opens another one.
interface Row {
  path: string
  name: string
  depth: number
  dir: boolean
  /** set on `adv/chapters/<chapter>/` folders */
  chapter?: string
}

const entryChapter = computed(() => story.value.program.entry.chapterId)

const rows = computed<Row[]>(() => {
  const order = (path: string) => {
    const chapter = path.match(/^adv\/chapters\/([^/]+)/)?.[1]
    const chapterRank = chapter ? (chapter === entryChapter.value ? 0 : 1) : 0
    const top = ['adv.config.json', 'adv/settings', 'adv/chapters', 'adv/characters', 'adv/world.md'].findIndex(prefix => path.startsWith(prefix))
    return [top === -1 ? 9 : top, chapterRank, path] as const
  }
  const writing = aiWriting.value?.path
  const files = [...story.value.files, ...(writing && !story.value.files.includes(writing) ? [writing] : [])].sort((a, b) => {
    const [x, y] = [order(a), order(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2])
  })
  const out: Row[] = []
  const seen = new Set<string>()
  for (const path of files) {
    const parts = path.split('/')
    parts.slice(0, -1).forEach((name, depth) => {
      const dir = parts.slice(0, depth + 1).join('/')
      if (seen.has(dir))
        return
      seen.add(dir)
      out.push({ path: dir, name: `${name}/`, depth, dir: true, chapter: parts[depth - 1] === 'chapters' && parts[depth - 2] === 'adv' ? name : undefined })
    })
    out.push({ path, name: parts.at(-1)!, depth: parts.length - 1, dir: false })
  }
  return out
})

const openFile = ref<string>()
const following = ref(true)
const shownFile = computed(() => (following.value ? aiWriting.value?.path ?? playingFile.value : openFile.value) ?? playingFile.value ?? story.value.chapters[0]?.sources[0])

watch(story, () => {
  following.value = true
  openFile.value = undefined
})

function open(path: string) {
  following.value = path === playingFile.value
  openFile.value = path
}

/** Nodes that start on each line of the shown file, for click-to-play. */
const lineToNode = computed(() => {
  const map: Record<number, { key: string, starts: boolean }> = {}
  for (const [key, source] of Object.entries(story.value.nodes)) {
    if (source.file === shownFile.value)
      source.lines.forEach((line, i) => map[line] = { key, starts: i === 0 })
  }
  return map
})

/** Build-time tokens for the hand-written stories; the AI run highlights its own files in the browser. */
const fileTokens = computed(() => {
  const path = shownFile.value ?? ''
  if (aiWriting.value?.path === path)
    return aiWriting.value.lines
  if (aiRun.value?.story.value === story.value)
    return aiRun.value.tokens.value[path] ?? []
  return sourceTokens[story.value.id]?.[path] ?? []
})

const sourceLines = computed(() => fileTokens.value.map((tokens, i) => {
  const node = lineToNode.value[i + 1]
  return {
    no: i + 1,
    tokens: tokens.map(token => ({ text: token.text, kind: token.role })),
    node: node?.key,
    starts: !!node?.starts,
    lit: !!litLines.value[shownFile.value ?? '']?.has(i + 1),
  }
}))

// On phones the tree is a strip; keep the playing file in sight as the playhead moves.
const treeEl = ref<HTMLElement>()
watch(playingFile, async () => {
  await nextTick()
  const tree = treeEl.value
  const row = tree?.querySelector<HTMLElement>('.is-playing')
  if (tree && row && tree.scrollWidth > tree.clientWidth)
    tree.scrollTo({ left: row.offsetLeft - 12, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
})

async function jumpToLine(key: string) {
  const [chapterId, nodeId] = key.split('#')
  following.value = true
  await jump({ chapterId, nodeId })
  // On narrow screens the stage sits above the source; bring it back into view.
  const rect = playerEl.value?.getBoundingClientRect()
  if (rect && (rect.bottom < 80 || rect.top > window.innerHeight))
    playerEl.value!.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

// RuntimeProgram pane: the node on stage, then the variables the runtime holds.
function tokenize(text: string): Token[][] {
  return text.split('\n').map((line) => {
    const tokens: Token[] = []
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|([{}[\],])|\b(true|false|null)\b/g
    let last = 0
    for (const m of line.matchAll(re)) {
      if (m.index! > last)
        tokens.push({ text: line.slice(last, m.index) })
      if (m[1])
        tokens.push({ text: m[1], kind: m[2] ? 'key' : 'str' }, ...(m[2] ? [{ text: m[2], kind: 'muted' }] : []))
      else if (m[3] || m[5])
        tokens.push({ text: m[0], kind: 'num' })
      else
        tokens.push({ text: m[4], kind: 'muted' })
      last = m.index! + m[0].length
    }
    tokens.push({ text: line.slice(last) })
    return tokens
  })
}

const json = computed(() => tokenize(JSON.stringify(current.value, null, 2)))
const stateJson = computed(() => Object.keys(variables.value).length ? tokenize(JSON.stringify(variables.value, null, 2)) : [])
</script>

<template>
  <section id="script" class="h-section script-demo" aria-labelledby="script-demo-title">
    <header class="h-head">
      <a class="h-anchor h-hud" href="#script">{#script}</a>
      <h2 id="script-demo-title" class="h-title">
        {{ t.script.title }}
      </h2>
      <p class="h-lead">
        <HomeRich :text="t.script.lead" />
      </p>
      <HomeSkinSwitcher compact class="switcher" />
    </header>

    <div class="demo">
      <div class="source h-ink h-skinned" :style="paletteVars">
        <div class="pane-bar">
          <span class="file">
            <span class="i-vscode-icons-default-root-folder-opened" aria-hidden="true" />
            <span class="crumbs">{{ story.id }}/<b>{{ shownFile }}</b></span>
          </span>
          <button v-if="!following" type="button" class="follow" @click="following = true">
            {{ t.script.follow }}
          </button>
          <span v-else class="hint">{{ t.script.hint }}</span>
        </div>
        <div class="explorer">
          <nav ref="treeEl" class="tree" :aria-label="t.script.files">
            <template v-for="row in rows" :key="row.path">
              <span v-if="row.dir" class="row is-dir" :style="{ '--depth': row.depth }">
                <span class="i-vscode-icons-default-folder-opened" aria-hidden="true" />
                <span class="name">{{ row.name }}</span>
                <span v-if="row.chapter" class="tag" :class="{ 'is-here': row.chapter === chapterId }">
                  {{ row.chapter === entryChapter ? t.script.entry : t.script.chapter }}
                </span>
              </span>
              <button
                v-else
                type="button"
                class="row is-file"
                :class="{ 'is-open': row.path === shownFile, 'is-playing': row.path === playingFile, 'is-writing': row.path === aiWriting?.path }"
                :style="{ '--depth': row.depth }"
                :aria-current="row.path === shownFile ? 'page' : undefined"
                @click="open(row.path)"
              >
                <span v-if="row.path.endsWith('.json')" class="i-vscode-icons-file-type-json" aria-hidden="true" />
                <span v-else class="i-vscode-icons-file-type-markdown" aria-hidden="true" />
                <span class="name">{{ row.name }}</span>
                <span v-if="row.path === aiWriting?.path" class="writing" aria-hidden="true" />
                <span v-else-if="row.path === playingFile" class="playhead" :aria-label="t.script.playing" />
              </button>
            </template>
          </nav>
          <div :key="`${story.id}/${shownFile}`" class="code" :aria-label="`${t.script.source}: ${shownFile}`">
            <component
              :is="line.starts ? 'button' : 'div'"
              v-for="line in sourceLines"
              :key="line.no"
              class="code-line"
              :class="{ 'is-active': line.lit, 'is-node': !!line.node }"
              :type="line.starts ? 'button' : undefined"
              :aria-current="line.starts && line.lit ? 'step' : undefined"
              @click="line.node && jumpToLine(line.node)"
            >
              <span class="no" aria-hidden="true">{{ line.no }}</span>
              <span class="text"><span v-for="(tok, i) in line.tokens" :key="i" :class="tok.kind && `t-${tok.kind}`">{{ tok.text }}</span></span>
            </component>
          </div>
        </div>
      </div>

      <div ref="playerEl" class="player">
        <div class="pane-bar">
          <div class="h-seg" role="tablist" :aria-label="t.script.preview">
            <button
              id="script-tab-stage" type="button" role="tab"
              :aria-selected="tab === 'stage'" aria-controls="script-panel-stage"
              @click="tab = 'stage'"
            >
              {{ t.script.stage }}
            </button>
            <button
              id="script-tab-json" type="button" role="tab"
              :aria-selected="tab === 'json'" aria-controls="script-panel-json"
              @click="tab = 'json'"
            >
              RuntimeProgram
            </button>
          </div>
          <span class="h-hud node-id">{{ currentId }}</span>
        </div>

        <div
          v-show="tab === 'stage'"
          id="script-panel-stage"
          class="screen-slot"
          role="tabpanel"
          aria-labelledby="script-tab-stage"
        >
          <component :is="skinComponents[skin].stage" class="h-skinned h-stage" :still="!inView" />
          <HomeTransitionCue />
        </div>

        <div
          v-show="tab === 'json'"
          id="script-panel-json"
          class="json h-ink"
          role="tabpanel"
          aria-labelledby="script-tab-json"
        >
          <div class="json-body">
            <p class="json-path">
              chapters.{{ chapterId }}.nodes["{{ currentId }}"]
            </p>
            <pre><code><span v-for="(line, i) in json" :key="i" class="json-line"><span v-for="(tok, j) in line" :key="j" :class="tok.kind && `t-${tok.kind}`">{{ tok.text }}</span>
</span></code></pre>
            <template v-if="stateJson.length">
              <p class="json-path is-state">
                runtime.state.variables
              </p>
              <pre><code><span v-for="(line, i) in stateJson" :key="i" class="json-line"><span v-for="(tok, j) in line" :key="j" :class="tok.kind && `t-${tok.kind}`">{{ tok.text }}</span>
</span></code></pre>
            </template>
          </div>
        </div>

        <ul class="notes">
          <li class="feature">
            <HomeRich :text="t.script.feature[skin]" />
          </li>
          <li v-for="note in t.script.notes" :key="note">
            <HomeRich :text="note" />
          </li>
          <li>
            <a class="h-link" href="/guide/advscript/syntax">{{ t.script.syntax }}</a>
          </li>
        </ul>
      </div>
    </div>

    <HomeAiSettings v-if="ai.settingsOpen.value" />
  </section>
</template>

<style scoped>
.demo {
  display: grid;
  gap: 20px;
}

@media (min-width: 960px) {
  .demo {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 24px;
    align-items: start;
  }
}

.source {
  order: 2;
}

.player {
  order: 1;
  min-width: 0;
  scroll-margin-top: calc(var(--vp-nav-height) + 16px);
}

@media (min-width: 960px) {
  .source {
    order: 0;
  }

  .player {
    order: 0;
    position: sticky;
    top: calc(var(--vp-nav-height) + 24px);
  }
}

.pane-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
}

.source .pane-bar {
  padding: 0 16px;
  border-bottom: 1px solid rgba(160, 190, 240, 0.12);
}

.player .pane-bar {
  margin-bottom: 12px;
}

.file {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-family: var(--h-mono);
  font-size: 13px;
  color: var(--h-mist-3);
}

.crumbs {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
}

.crumbs b {
  font-weight: 500;
  color: var(--h-mist);
}

.follow {
  flex: none;
  padding: 2px 10px;
  border: 1px solid var(--h-lamp);
  border-radius: 999px;
  font-size: 12px;
  color: var(--h-lamp);
  cursor: pointer;
}

/* Explorer: the project tree beside the open file */

.explorer {
  display: grid;
}

@media (min-width: 640px) {
  .explorer {
    grid-template-columns: 208px minmax(0, 1fr);
  }
}

.tree {
  display: flex;
  gap: 2px;
  padding: 10px 12px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(160, 190, 240, 0.12);
  font-family: var(--h-mono);
  font-size: 12px;
  scrollbar-width: thin;
}

@media (min-width: 640px) {
  .tree {
    flex-direction: column;
    padding: 12px 0;
    overflow: visible;
    border-right: 1px solid rgba(160, 190, 240, 0.12);
    border-bottom: 0;
  }
}

.row {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--h-mist-3);
  text-align: left;
  white-space: nowrap;
}

@media (min-width: 640px) {
  .row {
    padding: 0 10px 0 calc(10px + var(--depth) * 10px);
    border-radius: 0;
  }
}

/* On phones the tree is a strip of files; folders give way to their files */
@media (max-width: 639px) {
  .row.is-dir {
    display: none;
  }
}

.row .name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.row.is-file {
  cursor: pointer;
}

.row.is-file:hover {
  color: var(--h-mist);
  background: rgba(160, 190, 240, 0.06);
}

.row.is-open {
  color: var(--h-mist);
  background: rgba(160, 190, 240, 0.1);
}

.row.is-playing {
  color: #fff;
}

.row.is-playing .name {
  font-weight: 600;
}

/* The playhead: a lamp beside the file that's running, flaring as it arrives */
.playhead {
  flex: none;
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--h-lamp);
  box-shadow: 0 0 8px var(--h-lamp);
  animation: playhead-arrive 0.6s var(--h-ease);
}

/* AI mode: the file being written pulses until the engine accepts it */
.writing {
  flex: none;
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--h-cyan);
  box-shadow: 0 0 8px var(--h-cyan);
  animation: writing-pulse 1s ease-in-out infinite alternate;
}

@keyframes writing-pulse {
  from {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .writing {
    animation: none;
  }
}

.tag {
  margin-left: auto;
  padding: 0 6px;
  border: 1px solid rgba(160, 190, 240, 0.25);
  border-radius: 4px;
  font-size: 10px;
  line-height: 16px;
  color: var(--h-mist-3);
}

.tag.is-here {
  border-color: var(--h-lamp);
  color: var(--h-lamp);
}

.hint {
  display: none;
  font-size: 12px;
  color: var(--h-mist-3);
}

@media (min-width: 640px) {
  .hint {
    display: inline;
  }
}

.node-id {
  color: var(--vp-c-text-3);
}

/* Source */

.code {
  padding: 12px 0;
  font-family: var(--h-mono);
  font-size: 13.5px;
  line-height: 22px;
}

.code-line {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 22px;
  padding: 0 16px 0 0;
  text-align: left;
  color: inherit;
  transition: background-color 0.25s;
}

.code-line::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--h-lamp);
  opacity: 0;
  transition: opacity 0.25s;
}

.code-line.is-node {
  cursor: pointer;
}

.source .code-line:focus-visible {
  outline-offset: -2px;
}

.code-line.is-node:hover {
  background: rgba(160, 190, 240, 0.06);
}

.code-line.is-active {
  background: rgba(255, 196, 107, 0.1);
}

.code-line.is-active::before {
  opacity: 1;
}

.no {
  flex: none;
  width: 44px;
  padding-right: 14px;
  text-align: right;
  color: var(--h-mist-3);
  opacity: 0.7;
  user-select: none;
}

.is-active .no {
  color: var(--h-lamp);
  opacity: 1;
}

.text {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.t-muted {
  color: var(--adv-muted);
}

.t-key {
  color: var(--h-mist-2);
}

.t-str {
  color: var(--h-mist);
}

.t-num {
  color: var(--h-lamp);
}

/* AdvScript roles, coloured by the shared palette (packages/parser/syntaxes/adv.palette.json) */
.t-scene {
  font-weight: 700;
  color: var(--adv-scene);
}

.t-heading {
  font-weight: 700;
  color: #fff;
}

.t-speaker {
  font-weight: 700;
  color: var(--adv-speaker);
}

.t-status {
  color: var(--adv-status);
}

.t-narration {
  font-style: italic;
  color: var(--adv-narration);
}

.t-choice {
  color: var(--adv-choice);
}

.t-anchor {
  color: var(--adv-anchor);
}

/* Stage: drawn by the skin */

.screen-slot {
  position: relative;
}

.screen-slot,
.json {
  box-sizing: border-box;
  height: 480px;
}

@media (min-width: 640px) {
  .screen-slot,
  .json {
    height: auto;
    aspect-ratio: 4 / 3;
  }
}

/* JSON */

.json {
  display: flex;
  flex-direction: column;
}

.json-body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow: auto;
  scrollbar-color: rgba(160, 190, 240, 0.3) transparent;
}

.json-path {
  margin: 0 0 12px;
  font-family: var(--h-mono);
  font-size: 12px;
  color: var(--h-mist-3);
}

.json-path.is-state {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.json pre {
  margin: 0;
  font-family: var(--h-mono);
  font-size: 13px;
  line-height: 21px;
}

.json-line {
  white-space: pre-wrap;
}

/* Notes */

.switcher {
  margin-top: 24px;
  justify-content: flex-start;
}

.notes .feature {
  color: var(--vp-c-text-1);
}

.notes {
  display: grid;
  gap: 10px;
  margin: 20px 0 0;
  padding: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  list-style: none;
}

.notes :deep(code) {
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--h-mono);
  font-size: 0.9em;
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

@keyframes playhead-arrive {
  from {
    transform: scale(2.4);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .code-line,
  .code-line::before {
    transition: none;
  }

  .playhead {
    animation: none;
  }
}
</style>
