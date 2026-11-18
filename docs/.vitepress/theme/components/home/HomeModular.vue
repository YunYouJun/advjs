<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHomeCopy } from '../../composables/home'
import HomeRich from './HomeRich.vue'

type Mode = 'game' | 'embed'

interface Token {
  text: string
  kind?: string
}

const t = useHomeCopy()

const modes = computed<{ id: Mode, label: string }[]>(() => [
  { id: 'game', label: t.value.modular.game },
  { id: 'embed', label: t.value.modular.embed },
])

const mode = ref<Mode>('game')

const tree = `last-tram/
├── adv.config.json
├── adv/
│   ├── chapters/
│   │   └── tram.adv.md
│   ├── characters/
│   │   └── xiaoyun.character.md
│   └── world.md
└── public/`

const embed = computed(() => `// ${t.value.modular.embedComment}
const { createAdvRuntime } = await import('@advjs/core/runtime')
const program = await stories.load('keeper')

const runtime = createAdvRuntime({ program, plugins })
runtime.subscribe(state => renderDialog(state))
await runtime.start()`)

function highlight(code: string): Token[][] {
  const re = /(\/\/.*$)|('(?:[^'\\]|\\.)*')|\b(const|await|import|from)\b|([a-z_]\w*)(?=\()|([├└│─]+)/gi
  return code.split('\n').map((line) => {
    const tokens: Token[] = []
    let last = 0
    for (const m of line.matchAll(re)) {
      if (m.index! > last)
        tokens.push({ text: line.slice(last, m.index) })
      const kind = m[1] ? 'comment' : m[2] ? 'str' : m[3] ? 'kw' : m[4] ? 'fn' : 'muted'
      tokens.push({ text: m[0], kind })
      last = m.index! + m[0].length
    }
    tokens.push({ text: line.slice(last) })
    return tokens
  })
}

const code = computed(() => highlight(mode.value === 'game' ? tree : embed.value))
</script>

<template>
  <section id="compose" class="h-section modular" aria-labelledby="modular-title">
    <header class="h-head">
      <a class="h-anchor h-hud" href="#compose">{#compose}</a>
      <h2 id="modular-title" class="h-title">
        {{ t.modular.title }}
      </h2>
      <p class="h-lead">
        {{ t.modular.lead }}
      </p>
    </header>

    <div class="modes h-seg" role="tablist" :aria-label="t.modular.modes">
      <button
        v-for="item in modes"
        :id="`modular-tab-${item.id}`"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="mode === item.id"
        aria-controls="modular-panel"
        @click="mode = item.id"
      >
        {{ item.label }}
      </button>
    </div>

    <div
      id="modular-panel"
      class="panel"
      :class="`is-${mode}`"
      role="tabpanel"
      :aria-labelledby="`modular-tab-${mode}`"
    >
      <div class="pipeline h-card">
        <div class="group">
          <span class="group-label">{{ t.modular.build }}</span>
          <div class="group-row">
            <div class="node">
              <span class="node-name">.adv.md</span>
              <span class="node-note">{{ t.modular.source }}</span>
            </div>
            <i class="wire" aria-hidden="true" />
            <div class="node">
              <span class="node-name">@advjs/core/compiler</span>
              <span class="node-note">{{ t.modular.compiler }}</span>
            </div>
          </div>
        </div>

        <i class="wire" aria-hidden="true" />

        <div class="node is-data">
          <span class="node-name">RuntimeProgram</span>
          <span class="node-note">{{ t.modular.program }}</span>
        </div>

        <i class="wire" aria-hidden="true" />

        <div class="group">
          <span class="group-label">{{ t.modular.player }}</span>
          <div class="group-row">
            <div class="node">
              <span class="node-name">@advjs/core/runtime</span>
              <span class="node-note">{{ t.modular.runtime }}</span>
            </div>
            <i class="wire stack-only" aria-hidden="true" />
            <svg class="fork" viewBox="0 0 48 160" preserveAspectRatio="none" aria-hidden="true">
              <path class="fork-path to-game" d="M0 80 C24 80 24 32 48 32" />
              <path class="fork-path to-embed" d="M0 80 C24 80 24 128 48 128" />
            </svg>
            <div class="targets">
              <div class="node target is-game">
                <span class="node-name">advjs + @advjs/client</span>
                <span class="node-note">{{ t.modular.client }}</span>
              </div>
              <div class="node target is-embed">
                <span class="node-name">{{ t.modular.host }}</span>
                <span class="node-note">{{ t.modular.hostNote }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="detail">
        <pre class="code h-ink"><code><span v-for="(line, i) in code" :key="`${mode}-${i}`" class="code-line"><span v-for="(tok, j) in line" :key="j" :class="tok.kind && `t-${tok.kind}`">{{ tok.text }}</span>
</span></code></pre>
        <div v-if="mode === 'game'" class="copy">
          <p v-for="text in t.modular.gameCopy" :key="text">
            <HomeRich :text="text" />
          </p>
          <a class="h-link" href="/guide/project-structure">{{ t.modular.gameLink }}</a>
        </div>
        <div v-else class="copy">
          <p v-for="text in t.modular.embedCopy" :key="text">
            <HomeRich :text="text" />
          </p>
          <a class="h-link" href="/guide/runtime/embedding">{{ t.modular.embedLink }}</a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.modes {
  margin-bottom: 20px;
}

.panel {
  --wire: var(--vp-c-divider);
  --flow: var(--vp-c-brand-1);
}

/* Pipeline */

.pipeline {
  --h-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 28px 20px;
}

@media (min-width: 1100px) {
  .pipeline {
    flex-direction: row;
    align-items: center;
    padding: 36px 28px;
  }
}

.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 14px;
}

.group-label {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}

.group-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

@media (min-width: 1100px) {
  .group-row {
    flex-direction: row;
    align-items: center;
  }
}

.node {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  transition:
    opacity 0.3s,
    border-color 0.3s,
    box-shadow 0.3s;
}

@media (min-width: 1100px) {
  .node {
    flex: none;
    box-sizing: border-box;
    min-height: 64px;
    align-content: center;
  }

  .node-note {
    white-space: nowrap;
  }
}

.node-name {
  font-family: var(--h-mono);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--vp-c-text-1);
}

.node-note {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.node.is-data {
  border-color: transparent;
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    var(--h-accent) border-box;
}

/* Wires carry a moving dash to show which way data flows. */
.wire {
  flex: none;
  align-self: center;
  width: 2px;
  height: 28px;
  background: repeating-linear-gradient(180deg, var(--flow) 0 6px, transparent 6px 12px);
  background-size: 2px 12px;
  opacity: 0.7;
  animation: flow-y 0.8s linear infinite;
}

@media (min-width: 1100px) {
  .wire {
    flex: 1 1 24px;
    min-width: 20px;
    width: auto;
    height: 2px;
    background: repeating-linear-gradient(90deg, var(--flow) 0 6px, transparent 6px 12px);
    background-size: 12px 2px;
    animation-name: flow-x;
  }
}

.fork {
  display: none;
  flex: none;
  width: 40px;
  height: 160px;
  overflow: visible;
}

.fork-path {
  fill: none;
  stroke: var(--wire);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  transition: stroke 0.3s;
}

.is-game .to-game,
.is-embed .to-embed {
  stroke: var(--flow);
  stroke-dasharray: 6 6;
  animation: flow-dash 0.8s linear infinite;
}

@media (min-width: 1100px) {
  .fork {
    display: block;
  }

  .stack-only {
    display: none;
  }
}

.targets {
  display: grid;
  gap: 12px;
}

@media (min-width: 640px) {
  .targets {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1100px) {
  .targets {
    grid-template-rows: 64px 64px;
    grid-template-columns: none;
    gap: 32px;
  }
}

.target {
  opacity: 0.45;
}

.is-game .target.is-game,
.is-embed .target.is-embed {
  opacity: 1;
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

/* Detail */

.detail {
  display: grid;
  gap: 24px;
  margin-top: 24px;
}

@media (min-width: 960px) {
  .detail {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    gap: 40px;
    align-items: start;
  }
}

.code {
  margin: 0;
  padding: 20px 0;
  font-family: var(--h-mono);
  font-size: 13.5px;
  line-height: 1.75;
}

/* Scroll inside the frame so its outline stays put. */
.code code {
  display: block;
  padding: 0 22px;
  overflow-x: auto;
}

.t-comment,
.t-muted {
  color: var(--h-mist-3);
}

.t-str {
  color: var(--h-lamp);
}

.t-kw {
  color: var(--h-cyan);
}

.t-fn {
  color: var(--h-link);
}

.copy {
  font-size: 15px;
  line-height: 1.8;
  color: var(--vp-c-text-2);
}

.copy p {
  margin: 0 0 12px;
}

.copy :deep(code) {
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--h-mono);
  font-size: 0.9em;
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

@keyframes flow-x {
  to {
    background-position: 12px 0;
  }
}

@keyframes flow-y {
  to {
    background-position: 0 12px;
  }
}

@keyframes flow-dash {
  to {
    stroke-dashoffset: -12;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wire,
  .is-game .to-game,
  .is-embed .to-embed {
    animation: none;
  }
}
</style>
