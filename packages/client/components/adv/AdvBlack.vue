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
    text="5xl"
    font="bold"
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
  background-color: rgb(0 0 0 / 80%);

  :deep(p) {
    margin: 0.5rem;
  }
}
</style>
