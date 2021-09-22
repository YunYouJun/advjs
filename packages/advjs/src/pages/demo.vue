<template>
  <div class="adv-game h-screen bg-black" :style="advGameStyle">
    <base-layer v-show="!app.showUi" />
    <tachie-box :characters="characters" />
    <dialog-box
      v-show="app.showUi"
      :dialog="dialog"
      @click="nextDialog"
    />
    <user-interface v-show="app.showUi" />
  </div>
</template>

<script setup lang="ts">
import marked from 'marked'
import advParser from '@advjs/parser'
import { AdvItem, Character, Line } from '@advjs/parser/src/Serialize'
import BaseLayer from '../components/base/BaseLayer.vue'
import DialogBox from '../components/dialog/DialogBox.vue'
import TachieBox from '../components/tachie/TachieBox.vue'
import UserInterface from '../components/ui/UserInterface.vue'

import characters from '../data/characters'
import { useAppStore } from '~/stores/app'

const app = useAppStore()

const path = ref('./md/test.adv.md')
const advGameStyle = computed(() => {
  return {
    color: 'black',
    backgroundImage: 'url("/img/bg/night.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: 0,
    margin: 0,
  }
})

const advTextData = ref<AdvItem[]>([])
const curDialogs = ref<Line[]>([])
const dialog = reactive({
  name: '',
  words: '',
},
)

// 顺序，待优化
const order = ref(0)
const dialogIndex = ref(0)

onMounted(async() => {
  const mdText = await fetch(path.value).then((res) => {
    return res.text()
  })
  const lexed = marked.lexer(mdText)
  advTextData.value = advParser.parse(lexed)
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
        curCharacter.status = character.status
          ? character.status
          : 'default'
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

<style>
.adv-game {
  color: white;
}
</style>
