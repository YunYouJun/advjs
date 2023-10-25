<script lang="ts" setup>
// import { toHast } from 'mdast-util-to-hast'
// import { toHtml } from 'hast-util-to-html'

import type { AdvAst } from '@advjs/types'
import { onMounted, ref, watch } from 'vue'
import { useAdvCtx } from '@advjs/client'

const props = defineProps<{
  content: AdvAst.Narration
}>()

const $adv = useAdvCtx()

// const blackHtml = computed(() => {
//   const content = Object.assign({}, props.content)
//   // @ts-ignore
//   content.type = 'root'
//   const hast = toHast(content as MdastNode)
//   return toHtml(hast || [])
// })

const displaySentences = ref(Array.from({ length: props.content.children.length }).fill(''))

// const sentences = computed(() => {
//   if (!props.content || props.content.type !== 'narration') return
//   return props.content.children.map((item: any) => item.children[0].value)
// })

const typeInterval = 50

function next() {
  $adv.nav.next()
}

function playSentencesAnimation() {
  const sentences = props.content.children
  let beforeLen = 0
  sentences.forEach((item, i) => {
    setTimeout(() => {
      displaySentences.value[i] = item
    }, beforeLen * typeInterval)
    beforeLen += (item.length + 1)
  })
}

onMounted(() => {
  playSentencesAnimation()
})

watch(() => props.content, () => {
  displaySentences.value = Array.from({ length: props.content.children.length }).fill('')
  playSentencesAnimation()
})
</script>

<template>
  <div
    flex="~ col"
    class="adv-black absolute justify-center items-center"
    w="full"
    h="full"
    text="2xl"
    font="bold"
    @click="next"
  >
    <div class="words-wrapper relative" text="left">
      <PrintWords v-for="(item, i) in displaySentences" :key="i" :type-interval="typeInterval" m="2" :words="item" />
    </div>
  </div>
</template>

<style lang="scss">
.adv-black {
  background-color: rgba(0, 0, 0, 0.8);

  p {
    margin: 0.5rem;
  }
}
</style>
