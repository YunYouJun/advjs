<script setup lang="ts">
import type { JsonValue } from '@advjs/types'
import { computed, shallowRef, watch } from 'vue'
import { useAdvContext } from '../../composables'

const { $adv } = useAdvContext()
const pending = computed(() => $adv.store.state.pendingActivity)
const score = shallowRef(0.9)
const civilizationName = shallowRef('Seed')
const civilizationLevel = shallowRef(1)
const civilizationPrinciple = shallowRef('curiosity')
const jsonResult = shallowRef('{}')
const error = shallowRef('')

watch(() => pending.value?.id, () => {
  error.value = ''
  jsonResult.value = '{}'
})

async function complete(result: JsonValue) {
  error.value = ''
  try {
    await $adv.runtime.completeActivity(result)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function completeGeneric() {
  try {
    return complete(JSON.parse(jsonResult.value) as JsonValue)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <section v-if="pending" class="adv-activity" aria-live="polite">
    <div class="adv-activity__panel">
      <p class="adv-activity__eyebrow">
        {{ pending.type }}
      </p>

      <template v-if="pending.type === 'star-map/compare'">
        <h2>星图比对</h2>
        <p>观察星点分布，然后提交比对结果。</p>
        <label>
          相似度
          <input v-model.number="score" type="range" min="0" max="1" step="0.01">
          {{ score.toFixed(2) }}
        </label>
        <div class="adv-activity__actions">
          <button type="button" @click="complete({ matched: false, score })">
            未匹配
          </button>
          <button type="button" @click="complete({ matched: true, score })">
            确认匹配
          </button>
        </div>
      </template>

      <template v-else-if="pending.type === 'civilization/initialize'">
        <h2>文明初始化</h2>
        <label>名称 <input v-model="civilizationName"></label>
        <label>等级 <input v-model.number="civilizationLevel" type="number" min="1"></label>
        <label>核心原则 <input v-model="civilizationPrinciple"></label>
        <button
          type="button"
          @click="complete({ name: civilizationName, level: civilizationLevel, principle: civilizationPrinciple })"
        >
          初始化
        </button>
      </template>

      <template v-else>
        <h2>Runtime Activity</h2>
        <pre>{{ pending.input }}</pre>
        <textarea v-model="jsonResult" rows="5" aria-label="JSON result" />
        <button type="button" @click="completeGeneric">
          提交 JSON
        </button>
      </template>

      <p v-if="error" class="adv-activity__error">
        {{ error }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.adv-activity {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(3 7 18 / 72%);
  backdrop-filter: blur(10px);
}

.adv-activity__panel {
  display: flex;
  width: min(560px, 86vw);
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  border: 1px solid rgb(148 163 184 / 35%);
  border-radius: 1rem;
  background: rgb(15 23 42 / 94%);
  box-shadow: 0 24px 80px rgb(0 0 0 / 45%);
  color: white;
}

.adv-activity__panel label {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.adv-activity__panel input,
.adv-activity__panel textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid rgb(148 163 184 / 40%);
  border-radius: 0.4rem;
  background: rgb(2 6 23 / 70%);
  color: inherit;
}

.adv-activity__panel button {
  padding: 0.65rem 1rem;
  border: 1px solid rgb(125 211 252 / 60%);
  border-radius: 0.5rem;
  background: rgb(14 116 144 / 70%);
}

.adv-activity__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.adv-activity__eyebrow {
  color: #7dd3fc;
  font-family: monospace;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.adv-activity__error {
  color: #fca5a5;
}
</style>
