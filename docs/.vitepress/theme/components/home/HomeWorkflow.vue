<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHomeCopy, useInView, useReducedMotion, useTimer } from '../../composables/home'
import HomeTypewriter from './HomeTypewriter.vue'

interface Line {
  type: 'cmd' | 'agent'
  text: string
}

// Commands are the same in every locale; the copy adds each step's title, text and agent prompt.
const commands = [
  [
    'adv init last-tram --template default --name 末班电车',
    'cd last-tram',
    'adv agent install --client codex --skills default --mcp',
  ],
  [
    'adv check',
    'adv editor .',
  ],
  [
    'adv build',
    'adv deploy --provider cloudflare-pages --project last-tram',
  ],
]

const t = useHomeCopy()
const steps = computed(() => t.value.workflow.steps.map((step, i) => {
  const lines: Line[] = commands[i].map(text => ({ type: 'cmd', text }))
  if (step.prompt)
    lines.push({ type: 'agent', text: step.prompt })
  return { ...step, lines }
}))

const skills = [
  { name: 'adv-story', link: '/ai/skills/adv-story' },
  { name: 'adv-create', link: '/ai/skills/adv-create' },
  { name: 'adv-debug', link: '/ai/skills/adv-debug' },
  { name: 'adv-review', link: '/ai/skills/adv-review' },
]

const SPEED = 22
const GAP = 380
const HOLD = 3600

const root = ref<HTMLElement>()
const inView = useInView(root, 0.4)
const reduced = useReducedMotion()
const timer = useTimer()

const active = ref(0)
const plays = ref(0)
const typed = ref(false)
const pinned = ref(false)
const copied = ref(false)
const copyTimer = useTimer()

const lines = computed(() => {
  let delay = 0
  return steps.value[active.value].lines.map((line) => {
    const item = { ...line, delay }
    delay += Array.from(line.text).length * SPEED + GAP
    return item
  })
})

const autoplay = computed(() => !pinned.value && !reduced.value && inView.value)

function select(index: number) {
  pinned.value = true
  show(index)
}

function show(index: number) {
  active.value = index
  typed.value = false
  plays.value++
}

watch(inView, (visible) => {
  if (visible && plays.value === 0)
    show(0)
}, { flush: 'post' })

watch([typed, autoplay], () => {
  timer.clear()
  if (typed.value && autoplay.value)
    timer.start(() => show((active.value + 1) % steps.value.length), HOLD)
})

async function copy() {
  const text = commands[active.value].join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    copyTimer.start(() => copied.value = false, 2000)
  }
  catch {}
}
</script>

<template>
  <section id="workflow" ref="root" class="h-section workflow" aria-labelledby="workflow-title">
    <header class="h-head">
      <a class="h-anchor h-hud" href="#workflow">{#workflow}</a>
      <h2 id="workflow-title" class="h-title">
        {{ t.workflow.title }}
      </h2>
      <p class="h-lead">
        {{ t.workflow.lead }}
      </p>
    </header>

    <div class="layout">
      <ol class="steps">
        <li v-for="(step, i) in steps" :key="step.title">
          <button
            type="button"
            class="step h-card"
            :class="{ 'is-active': active === i }"
            :aria-current="active === i ? 'step' : undefined"
            @click="select(i)"
          >
            <span class="step-no h-hud" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="step-body">
              <span class="step-title">{{ step.title }}</span>
              <span class="step-text">{{ step.text }}</span>
            </span>
            <span
              v-if="active === i && typed && autoplay"
              :key="plays"
              class="step-progress"
              :style="{ animationDuration: `${HOLD}ms` }"
              aria-hidden="true"
            />
          </button>
        </li>
      </ol>

      <div class="terminal h-ink">
        <div class="terminal-bar">
          <span class="cwd">~/last-tram</span>
          <button type="button" class="copy" @click="copy">
            <span :class="copied ? 'i-ri-check-line' : 'i-ri-file-copy-line'" aria-hidden="true" />
            {{ copied ? t.workflow.copied : t.workflow.copy }}
          </button>
        </div>
        <div class="terminal-body" :class="{ 'is-typing': plays > 0 }" :aria-label="t.workflow.terminal(steps[active].title)">
          <p
            v-for="(line, i) in lines"
            :key="`${plays}-${i}`"
            class="term-line"
            :class="`is-${line.type}`"
            :style="{ '--d': `${line.delay}ms` }"
          >
            <span class="prompt" aria-hidden="true">{{ line.type === 'cmd' ? '$' : '›' }}</span>
            <span v-if="line.type === 'agent'" class="agent-tag">{{ t.workflow.promptTag }}</span>
            <HomeTypewriter
              :text="line.text"
              :speed="SPEED"
              :delay="line.delay"
              :instant="plays === 0"
              @done="i === lines.length - 1 && (typed = true)"
            />
          </p>
          <span v-if="typed" class="cursor" aria-hidden="true" />
        </div>
      </div>
    </div>

    <div class="agents">
      <p class="agents-line">
        <span class="agent-icons" aria-hidden="true">
          <span class="i-simple-icons-openai" />
          <span class="i-simple-icons-claude" />
          <span class="i-simple-icons-cursor" />
        </span>
        {{ t.workflow.agents }}
      </p>
      <ul class="skills">
        <li v-for="skill in skills" :key="skill.name">
          <a :href="skill.link">{{ skill.name }}</a>
        </li>
        <li>
          <a href="/ai/mcp">MCP Server</a>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.layout {
  display: grid;
  gap: 24px;
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: minmax(0, 4fr) minmax(0, 7fr);
    gap: 40px;
    align-items: start;
  }
}

/* Steps */

.steps {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  --line: transparent;
  --edge: transparent;
  --fill: transparent;
  display: flex;
  gap: 18px;
  width: 100%;
  padding: 18px 18px 20px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
}

.step:hover {
  --fill: var(--vp-c-default-soft);
}

.step.is-active {
  --line: var(--vp-c-divider);
  --edge: var(--vp-c-brand-3);
  --fill: var(--vp-c-bg-soft);
}

.step-no {
  flex: none;
  padding-top: 5px;
  font-size: 14px;
  color: var(--vp-c-text-3);
  transition: color 0.25s;
}

.is-active .step-no {
  color: var(--vp-c-brand-1);
}

.step-body {
  display: grid;
  gap: 6px;
}

.step-title {
  font-family: var(--h-story);
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-1);
}

.adv-home[data-locale='en'] .step-title {
  letter-spacing: 0.01em;
}

.step-text {
  font-size: 15px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

@media (max-width: 959px) {
  .step {
    padding: 12px 16px 14px;
  }

  .step:not(.is-active) .step-text {
    display: none;
  }
}

.step-progress {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--h-accent);
  transform-origin: left;
  animation: progress linear both;
}

/* Terminal */

.terminal {
  overflow: hidden;
}

.terminal-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 12px 0 18px;
  border-bottom: 1px solid rgba(160, 190, 240, 0.12);
}

.cwd {
  font-family: var(--h-mono);
  font-size: 13px;
  color: var(--h-mist-3);
}

.copy {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--h-mist-2);
  cursor: pointer;
}

.copy:hover {
  color: #fff;
  background: rgba(160, 190, 240, 0.1);
}

.terminal-body {
  min-height: 260px;
  padding: 20px 20px 24px;
  font-family: var(--h-mono);
  font-size: 14px;
  line-height: 1.7;
}

.term-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  margin: 0 0 10px;
  overflow-wrap: anywhere;
}

.is-typing .term-line {
  animation: line-in 1ms linear both;
  animation-delay: var(--d);
}

.prompt {
  color: var(--h-cyan);
}

.is-agent {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed rgba(160, 190, 240, 0.2);
  font-family: var(--vp-font-family-base);
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.is-agent .prompt {
  color: var(--h-lamp);
}

.agent-tag {
  align-self: center;
  padding: 0 8px;
  border-radius: 5px;
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  color: #3b2400;
  background: var(--h-lamp);
}

.is-agent :deep(.h-type) {
  flex-basis: 100%;
}

.cursor {
  display: inline-block;
  width: 9px;
  height: 18px;
  vertical-align: middle;
  background: var(--h-cyan);
  animation: blink 1.1s steps(1) infinite;
}

/* Agents */

.agents {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  align-items: center;
  justify-content: space-between;
  margin-top: 28px;
  font-size: 15px;
  color: var(--vp-c-text-2);
}

.agents-line {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 0;
}

.agent-icons {
  display: inline-flex;
  gap: 8px;
  font-size: 18px;
  color: var(--vp-c-text-1);
}

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skills a {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-family: var(--h-mono);
  font-size: 13px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.skills a:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

@keyframes progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes line-in {
  from {
    opacity: 0;
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cursor,
  .is-typing .term-line {
    animation: none;
  }
}
</style>
