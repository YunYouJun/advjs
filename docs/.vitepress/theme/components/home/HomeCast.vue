<script setup lang="ts">
import { computed } from 'vue'
import advPalette from '../../../../../packages/parser/syntaxes/adv.palette.json'
import { useHomeCopy } from '../../composables/home'
import FeatureStatus from '../FeatureStatus.vue'
import { review, terminal } from './data/cast-previews'

const t = useHomeCopy()

// The cast is written the way .adv.md writes it: `@speaker` and a 【scene】 note,
// coloured like the editor colours them, on either side of the page theme.
const paletteVars = {
  '--speaker-light': advPalette.palettes.light.speaker,
  '--speaker-dark': advPalette.palettes.dark.speaker,
  '--scene-light': advPalette.palettes.light.scene,
  '--scene-dark': advPalette.palettes.dark.scene,
}

const cast = computed(() => {
  const c = t.value.cast
  return [
    {
      name: 'advjs',
      preview: 'terminal' as const,
      where: c.where.advjs,
      line: c.advjs,
      links: [{ text: c.cli, link: '/guide/cli' }],
    },
    {
      name: 'Editor',
      where: c.where.editor,
      line: c.editor,
      links: [
        { text: c.editorWeb, link: 'https://editor.advjs.org' },
        { text: c.editorDesktop, link: '/guide/editor/desktop', feature: 'editor-desktop' },
      ],
    },
    {
      name: 'Studio',
      feature: 'studio',
      where: c.where.studio,
      line: c.studio,
      links: [{ text: c.studioLink, link: '/guide/studio/' }],
    },
    {
      name: 'Skills',
      preview: 'review' as const,
      where: c.where.skills,
      line: c.skills,
      links: [{ text: c.skillsLink, link: '/ai/skills/' }],
    },
  ]
})
</script>

<template>
  <section id="cast" class="h-section cast" aria-labelledby="cast-title">
    <header class="h-head">
      <a class="h-anchor h-hud" href="#cast">{#cast}</a>
      <h2 id="cast-title" class="h-title">
        {{ t.cast.title }}
      </h2>
      <p class="h-lead">
        {{ t.cast.lead }}
      </p>
    </header>

    <ul class="roles" :style="paletteVars">
      <li v-for="role in cast" :key="role.name" class="role">
        <div class="cue">
          <h3 class="cue-name">
            <span class="cue-at" aria-hidden="true">@</span>{{ role.name }}
            <FeatureStatus v-if="role.feature" :id="role.feature" class="cue-status" />
          </h3>
          <p class="cue-where">
            {{ role.where }}
          </p>
        </div>
        <div class="role-body">
          <p class="role-line">
            {{ role.line }}
          </p>
          <p class="role-links">
            <a
              v-for="item in role.links"
              :key="item.link"
              class="h-link"
              :href="item.link"
              :target="item.link.startsWith('http') ? '_blank' : undefined"
              :rel="item.link.startsWith('http') ? 'noreferrer' : undefined"
            >{{ item.text }}<FeatureStatus v-if="item.feature" :id="item.feature" class="link-status" /></a>
          </p>
        </div>

        <figure v-if="role.preview" class="preview">
          <template v-if="role.preview === 'terminal'">
            <div class="term" role="img" :aria-label="t.cast.preview.terminal">
              <template v-for="(line, i) in terminal" :key="i">
                <span v-if="i === 3" class="term-line is-note">{{ t.cast.preview.written }}</span>
                <span class="term-line" :class="line.kind && `is-${line.kind}`">{{ line.text }}</span>
              </template>
            </div>
          </template>

          <template v-else>
            <div class="agent" role="img" :aria-label="t.cast.preview.review">
              <p class="agent-prompt">
                <span class="agent-who">{{ t.cast.preview.you }}</span>
                <span>{{ review.prompt }}</span>
              </p>
              <div class="agent-reply">
                <p class="agent-who">
                  {{ review.agent }} <span class="skill">{{ review.skill }}</span>
                </p>
                <p v-for="(line, i) in review.lines" :key="i" class="agent-line" :class="`is-${line.kind}`">
                  {{ line.text }}
                </p>
              </div>
            </div>
          </template>
          <figcaption class="preview-caption">
            {{ t.cast.preview[role.preview] }}
          </figcaption>
        </figure>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.roles {
  --speaker: var(--speaker-light);
  --scene: var(--scene-light);
  margin: 0;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--vp-c-divider);
}

.dark .roles {
  --speaker: var(--speaker-dark);
  --scene: var(--scene-dark);
}

.role {
  display: grid;
  gap: 12px;
  padding: 26px 0 28px;
  border-top: 1px solid var(--vp-c-divider);
}

@media (min-width: 768px) {
  .role {
    grid-template-columns: minmax(11rem, 16rem) minmax(0, 1fr);
    gap: 0 48px;
    padding: 36px 0 38px;
  }

  .preview {
    grid-column: 2;
    margin-top: 20px;
  }
}

@media (min-width: 1100px) {
  .role:has(.preview) {
    grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 0 40px;
    align-items: start;
  }

  .preview {
    grid-column: 3;
    margin-top: 0;
  }
}

/* Previews */

.preview {
  margin: 8px 0 0;
  min-width: 0;
}

.preview-caption {
  margin-top: 8px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

/* advjs: a terminal, always a night pane like the script source */
.term {
  display: grid;
  padding: 14px 16px;
  overflow-x: auto;
  border-radius: 10px;
  font-family: var(--h-mono);
  font-size: 12px;
  line-height: 1.75;
  color: #c9d1d9;
  background: var(--h-ink);
  box-shadow: 0 0 0 1px rgba(160, 190, 240, 0.12);
}

.term-line {
  white-space: pre;
}

.term-line.is-cmd {
  margin-top: 6px;
  color: #fff;
}

.term-line.is-cmd:first-child {
  margin-top: 0;
}

.term-line.is-cmd::before {
  content: '$ ';
  color: var(--h-lamp);
}

.term-line.is-ok {
  color: #8fd19e;
}

.term-line.is-info {
  color: #e6d3a3;
}

.term-line.is-dim,
.term-line.is-cut {
  color: #7d8590;
}

.term-line.is-note {
  margin-top: 6px;
  font-style: italic;
  color: #7d8590;
}

/* Skills: the ask, then the agent's answer */
.agent {
  display: grid;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.7;
}

.agent p {
  margin: 0;
}

.agent-prompt {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-self: end;
  max-width: 90%;
  padding: 8px 14px;
  border-radius: 10px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.agent-who {
  font-family: var(--h-mono);
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.agent-reply {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-left: 2px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.skill {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 4px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.agent-line.is-dim {
  color: var(--vp-c-text-3);
}

.agent-line.is-fix {
  margin-top: 4px;
  font-weight: 700;
}

.agent-line.is-fix::before {
  content: '✗ ';
  color: #d14b4b;
}

.agent-line.is-suggest {
  font-family: var(--h-story);
  color: var(--vp-c-text-2);
}

.agent-line.is-keep::before {
  content: '✓ ';
  color: #3f9a5a;
}

.cue {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: baseline;
}

@media (min-width: 768px) {
  .cue {
    flex-direction: column;
    gap: 10px;
  }
}

.cue-name {
  position: relative;
  margin: 0;
  font-family: var(--h-story);
  font-size: clamp(28px, 2.8vw, 36px);
  font-weight: 900;
  line-height: 1.1;
  color: var(--vp-c-text-1);
}

.cue-at {
  margin-right: 0.06em;
  font-family: var(--h-system);
  font-size: 0.78em;
  font-weight: 700;
  color: var(--speaker);
}

/* The line being read: the same cursor the in-game choices use */
.cue-name::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -18px;
  width: 6px;
  height: 6px;
  background: var(--speaker);
  opacity: 0;
  transform: translate(-6px, -50%) rotate(45deg);
  transition:
    opacity 0.2s,
    transform 0.25s var(--h-ease);
}

.role:hover .cue-name::before,
.role:focus-within .cue-name::before {
  opacity: 1;
  transform: translate(0, -50%) rotate(45deg);
}

.cue-status {
  margin-left: 10px;
  vertical-align: 0.5em;
}

.link-status {
  margin-left: 6px;
}

.cue-where {
  margin: 0;
  font-family: var(--h-story);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--scene);
}

.adv-home[data-locale='en'] .cue-status {
  margin-left: 10px;
  vertical-align: 0.5em;
}

.link-status {
  margin-left: 6px;
}

.cue-where {
  font-style: italic;
  font-weight: 500;
  letter-spacing: 0;
}

.role-body {
  max-width: 38em;
}

.role-line {
  margin: 0;
  font-size: 17px;
  line-height: 1.85;
  color: var(--vp-c-text-1);
  text-wrap: pretty;
}

.role-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 14px 0 0;
  font-size: 15px;
}

@media (prefers-reduced-motion: reduce) {
  .cue-name::before {
    transition: none;
  }
}
</style>
