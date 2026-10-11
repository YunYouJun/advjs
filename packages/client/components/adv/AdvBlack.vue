<script setup lang="ts">
import type { RuntimeNode } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

const props = defineProps<{
  node: RuntimeNode
}>()

const { $adv } = useAdvContext()
interface Sentence {
  text: string
  started: boolean
  run: number
}

const displaySentences = shallowRef<Sentence[]>([])
const revealAll = shallowRef(false)
const completed = new Set<number>()
let run = 0
const printed = shallowRef(false)
const typeInterval = 50
const timers = new Set<ReturnType<typeof setTimeout>>()

function sentences(): string[] {
  const text = props.node.data?.text
  return typeof text === 'string' ? text.split('\n') : []
}

function clearTimers() {
  for (const timer of timers)
    clearTimeout(timer)
  timers.clear()
}

function finishSentence(index: number, sentenceRun: number) {
  if (sentenceRun !== run || printed.value)
    return
  completed.add(index)
  if (completed.size === displaySentences.value.length) {
    printed.value = true
    $adv.$auto.notifyPrintDone()
  }
}

function playSentencesAnimation() {
  clearTimers()
  run++
  completed.clear()
  printed.value = false
  revealAll.value = false
  const values = sentences()
  displaySentences.value = values.map(text => ({ text, started: false, run }))
  if (!values.length) {
    printed.value = true
    $adv.$auto.notifyPrintDone()
    return
  }
  let beforeLength = 0
  values.forEach((value, index) => {
    const timer = setTimeout(() => {
      displaySentences.value = displaySentences.value.map((sentence, sentenceIndex) => (
        sentenceIndex === index ? { ...sentence, started: true } : sentence
      ))
      timers.delete(timer)
    }, beforeLength * typeInterval)
    timers.add(timer)
    beforeLength += value.length + 1
  })
}

function next() {
  if (!printed.value) {
    clearTimers()
    revealAll.value = true
    displaySentences.value = displaySentences.value.map(sentence => ({ ...sentence, started: true }))
  }
  else {
    $adv.runtime.next()
  }
}

onMounted(playSentencesAnimation)
onBeforeUnmount(() => {
  run++
  clearTimers()
})
watch(() => props.node, playSentencesAnimation)
</script>

<template>
  <div
    class="adv-black items-center justify-center absolute"
    flex="~ col"
    w="full"
    h="full"
    @click="next"
  >
    <div class="words-wrapper relative" text="left">
      <template v-for="(item, index) in displaySentences" :key="`${item.run}:${index}`">
        <PrintWords
          v-if="item.started"
          :printed="revealAll"
          :type-interval="typeInterval"
          m="2"
          :words="item.text"
          @end="finishSentence(index, item.run)"
        />
        <div v-else class="print-words" m="2" />
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.adv-black {
  inset: 0;
  box-sizing: border-box;
  background-color: rgb(0 0 0 / 80%);
  padding: clamp(2rem, 8vw, 9rem);
  font-size: clamp(1.4rem, 3vw, 3rem);
  font-weight: 600;
  line-height: 1.75;
  letter-spacing: 0.035em;

  .words-wrapper {
    width: min(100%, 72rem);
  }

  :deep(p) {
    margin: 0.75rem 0;
  }
}
</style>
