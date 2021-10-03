<template>
  <div class="adv-game w-screen h-screen bg-black" :style="advGameStyle">
    <BaseLayer v-show="!app.showUi" />
    <TachieBox :characters="characters" />
    <DialogBox v-show="app.showUi" :dialog="dialog" @click="nextDialog" />
    <UserInterface v-show="app.showUi" />
  </div>
</template>

<script setup lang="ts">
import marked from 'marked'
import { parse } from '@advjs/parser'
import { AdvItem, Character, Line } from '@advjs/parser/Serialize'

import { characters } from '../data/characters'
import { useAppStore } from '~/stores/app'

import { useBeforeUnload } from '~/client/app/composables'
useBeforeUnload()

const app = useAppStore()

const path = ref('./md/test.adv.md')
const advGameStyle = computed(() => {
  return {
    backgroundImage: 'url("/img/bg/night.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
})

const advTextData = ref<AdvItem[]>([])
const curDialogs = ref<Line[]>([])
const dialog = reactive({
  name: '',
  words: '',
})

// 顺序，待优化
const order = ref(0)
const dialogIndex = ref(0)

onMounted(async() => {
  const mdText = await fetch(path.value).then((res) => {
    return res.text()
  })
  const lexed = marked.lexer(mdText)
  advTextData.value = parse(lexed)
  nextParagraph()
})

function nextParagraph() {
  while (order.value < advTextData.value.length) {
    const item = advTextData.value[order.value] as AdvItem
    order.value++
    if (item.type === 'narration') {
      dialog.name = ''
      dialog.words = item.text
      updateTachieStatus()
      break
    }
    if (item.type === 'paragraph') {
      curDialogs.value = item.children
      nextDialog()
      break
    }
  }
}

function nextDialog() {
  if (dialogIndex.value === curDialogs.value.length) {
    dialogIndex.value = 0
    curDialogs.value = []
    nextParagraph()
  }
  else if (dialogIndex.value < curDialogs.value.length) {
    const line = curDialogs.value[dialogIndex.value] as Line
    dialog.name = line.character.name
    dialog.words = line.words.text
    updateTachieStatus(line.character)
    dialogIndex.value++
  }
}

function updateTachieStatus(character?: Character) {
  characters.forEach((curCharacter) => {
    if (character) {
      if (character.name === curCharacter.name) {
        curCharacter.active = true
        curCharacter.status = character.status ? character.status : 'default'
      }
      else {
        curCharacter.active = false
      }
    }
    else {
      curCharacter.active = false
    }
  })
}
</script>

<style lang="scss">
@import '~/styles/adv.scss';
</style>

<route lang="yaml">
meta:
  layout: adv
</route>
