<script setup lang="ts">
import type { DisplayFontSize, DisplaySpeed, MotionPreference } from '@advjs/client'
import { useAdvContext, useAdvSettingsControls, useAudioStore } from '@advjs/client'

const { $adv } = useAdvContext()
const controls = useAdvSettingsControls()
const audio = useAudioStore()
const motionOptions: Array<{ value: MotionPreference, label: string, hint: string }> = [
  { value: 'full', label: '完整', hint: '保留转场、入场与逐帧动画' },
  { value: 'reduced', label: '克制', hint: '缩短转场并降低舞台位移' },
  { value: 'none', label: '关闭', hint: '直接切换最终画面' },
]
const fontOptions: Array<{ value: DisplayFontSize, label: string }> = [
  { value: 'xl', label: '小' },
  { value: '2xl', label: '标准' },
  { value: '3xl', label: '大' },
  { value: '4xl', label: '特大' },
]
const speedOptions: Array<{ value: DisplaySpeed, label: string }> = [
  { value: 'slow', label: '慢速' },
  { value: 'normal', label: '标准' },
  { value: 'fast', label: '快速' },
  { value: 'very_fast', label: '瞬时' },
]

function setMotion(value: MotionPreference) {
  controls.motion.value = value
}

function setFont(value: DisplayFontSize) {
  controls.settings.storage.text.curFontSize = value
}

function setSpeed(value: DisplaySpeed) {
  controls.settings.storage.text.curSpeed = value
}

function resetAll() {
  controls.reset()
  audio.reset()
  $adv.$bgm.setVolume(audio.bgmVolume)
}
</script>

<template>
  <section class="hamster-settings" aria-labelledby="hamster-settings-title">
    <header>
      <div>
        <p>ORBITAL CONTROL</p>
        <h2 id="hamster-settings-title">
          观测参数
        </h2>
      </div>
      <span>所有参数即时生效</span>
    </header>

    <div class="hamster-settings__body">
      <fieldset>
        <legend>场景动态效果</legend>
        <div class="hamster-settings__cards">
          <button
            v-for="option in motionOptions"
            :key="option.value"
            type="button"
            :class="{ active: controls.motion.value === option.value }"
            @click="setMotion(option.value)"
          >
            <b>{{ option.label }}</b>
            <small>{{ option.hint }}</small>
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>文字与节奏</legend>
        <div class="hamster-settings__row">
          <span>正文字号</span>
          <div>
            <button
              v-for="option in fontOptions"
              :key="option.value"
              type="button"
              :class="{ active: controls.settings.storage.text.curFontSize === option.value }"
              @click="setFont(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="hamster-settings__row">
          <span>打印速度</span>
          <div>
            <button
              v-for="option in speedOptions"
              :key="option.value"
              type="button"
              :class="{ active: controls.settings.storage.text.curSpeed === option.value }"
              @click="setSpeed(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>声音</legend>
        <label class="hamster-settings__slider">
          <span>背景音乐</span>
          <input v-model.number="audio.bgmVolume" type="range" min="0" max="1" step="0.05">
          <output>{{ Math.round(audio.bgmVolume * 100) }}%</output>
        </label>
        <label class="hamster-settings__slider">
          <span>界面音效</span>
          <input v-model.number="audio.soundVolume" type="range" min="0" max="1" step="0.05">
          <output>{{ Math.round(audio.soundVolume * 100) }}%</output>
        </label>
      </fieldset>
    </div>

    <footer>
      <button type="button" @click="controls.toggleFullscreen">
        切换全屏
      </button>
      <button type="button" @click="controls.toggleLandscape">
        横屏观测
      </button>
      <button type="button" @click="resetAll">
        恢复默认
      </button>
    </footer>
  </section>
</template>

<style scoped>
.hamster-settings {
  --ink: #f3eee4;
  --muted: #aeb8ce;
  --amber: #f6c96b;
  --cyan: #75ddeb;
  width: min(58rem, 88vw);
  max-height: min(46rem, 84vh);
  overflow: auto;
  border: 1px solid rgb(117 221 235 / 28%);
  background:
    radial-gradient(circle at 100% 0, rgb(31 78 111 / 28%), transparent 34%),
    linear-gradient(145deg, rgb(7 10 18 / 98%), rgb(12 21 42 / 96%));
  color: var(--ink);
  text-align: left;
  box-shadow: 0 2rem 8rem rgb(0 0 0 / 72%);
}

.hamster-settings header,
.hamster-settings footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(117 221 235 / 20%);
  padding: 1.4rem 1.6rem;
}

.hamster-settings header p {
  margin: 0;
  color: var(--cyan);
  font: 0.65rem/1.4 monospace;
  letter-spacing: 0.22em;
}

.hamster-settings h2 {
  margin: 0.25rem 0 0;
  font:
    600 2rem/1.1 'Songti SC',
    STSong,
    serif;
}

.hamster-settings header > span {
  color: var(--muted);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
}

.hamster-settings__body {
  display: grid;
  gap: 1.2rem;
  padding: 1.5rem 1.6rem;
}

.hamster-settings fieldset {
  border: 1px solid rgb(174 184 206 / 18%);
  margin: 0;
  padding: 1rem;
}

.hamster-settings legend {
  padding: 0 0.5rem;
  color: var(--amber);
  font-family: 'Songti SC', STSong, serif;
  letter-spacing: 0.12em;
}

.hamster-settings__cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.7rem;
}

.hamster-settings button {
  border: 1px solid rgb(117 221 235 / 24%);
  background: rgb(7 12 24 / 72%);
  padding: 0.65rem 0.8rem;
  color: var(--muted);
  cursor: pointer;
}

.hamster-settings__cards button {
  display: flex;
  min-height: 5rem;
  align-items: flex-start;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.hamster-settings button.active,
.hamster-settings button:hover,
.hamster-settings button:focus-visible {
  border-color: var(--cyan);
  background: rgb(28 61 83 / 56%);
  color: var(--ink);
  outline: none;
}

.hamster-settings button small {
  color: var(--muted);
  line-height: 1.45;
}

.hamster-settings__row,
.hamster-settings__slider {
  display: grid;
  align-items: center;
  gap: 0.8rem;
  grid-template-columns: 7rem 1fr auto;
  padding: 0.55rem 0;
}

.hamster-settings__row > div {
  display: flex;
  gap: 0.4rem;
}

.hamster-settings__slider input {
  width: 100%;
  accent-color: var(--amber);
}
.hamster-settings__slider output {
  min-width: 3rem;
  color: var(--cyan);
  font-family: monospace;
}

.hamster-settings footer {
  justify-content: flex-end;
  gap: 0.55rem;
  border-top: 1px solid rgb(117 221 235 / 20%);
  border-bottom: 0;
}

@media (max-width: 680px) {
  .hamster-settings {
    width: 94vw;
    max-height: 88vh;
  }
  .hamster-settings header > span {
    display: none;
  }
  .hamster-settings__cards {
    grid-template-columns: 1fr;
  }
  .hamster-settings__row,
  .hamster-settings__slider {
    grid-template-columns: 1fr;
  }
  .hamster-settings__row > div {
    flex-wrap: wrap;
  }
  .hamster-settings footer {
    flex-wrap: wrap;
  }
}
</style>
