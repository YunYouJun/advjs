<script setup lang="ts">
import type { RuntimeNode } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

const props = defineProps<{
  node: RuntimeNode
}>()

const { $adv } = useAdvContext()
const displaySentences = shallowRef<string[]>([])
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

function playSentencesAnimation() {
  clearTimers()
  const values = sentences()
  displaySentences.value = Array.from({ length: values.length }).fill('') as string[]
  let beforeLength = 0
  values.forEach((value, index) => {
    const timer = setTimeout(() => {
      const next = [...displaySentences.value]
      next[index] = value
      displaySentences.value = next
      timers.delete(timer)
    }, beforeLength * typeInterval)
    timers.add(timer)
    beforeLength += value.length + 1
  })
}

function next() {
  if (!printed.value)
    printed.value = true
  else
    $adv.runtime.next()
}

onMounted(playSentencesAnimation)
onBeforeUnmount(clearTimers)
watch(() => props.node.id, () => {
  printed.value = false
  playSentencesAnimation()
})
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
      <PrintWords
        v-for="(item, index) in displaySentences"
        :key="index"
        v-model:printed="printed"
        :type-interval="typeInterval"
        m="2"
        :words="item"
        @end="$adv.$auto.notifyPrintDone()"
      />
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
