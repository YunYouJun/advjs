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
    <div class="words-wrapper" text="left">
      <PrintWords v-for="item,i in displaySentences" :key="i" :type-interval="typeInterval" m="2" :words="item" />
    </div>
  </div>
</template>

<script lang="ts" setup>
// import { toHast } from 'mdast-util-to-hast'
// import { toHtml } from 'hast-util-to-html'

import type { Narration } from '@advjs/types'
import { adv } from '~/setup/adv'

const props = defineProps<{
  content: Narration
}>()

// const blackHtml = computed(() => {
//   const content = Object.assign({}, props.content)
//   // @ts-ignore
//   content.type = 'root'
//   const hast = toHast(content as MdastNode)
//   return toHtml(hast || [])
// })

const displaySentences = ref(new Array(props.content.children.length).fill(''))

// const sentences = computed(() => {
//   if (!props.content || props.content.type !== 'narration') return
//   return props.content.children.map((item: any) => item.children[0].value)
// })

const typeInterval = 150

const next = () => {
  adv.next()
}

const playSentencesAnimation = () => {
  const sentences = props.content.children.map((item: any) => item.value)
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
  displaySentences.value = new Array(props.content.children.length).fill('')
  playSentencesAnimation()
})
</script>

<style lang="scss">
.adv-black {
  background-color: var(--adv-modal-bg-color);

  p {
    margin: 0.5rem;
  }
}
</style>
