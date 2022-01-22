<template>
  <div class="dialog-box select-none" grid="~ cols-12" gap="12" @click="next">
    <div v-if="curCharacter" class=" col-span-3 text-right">
      <template v-if="gameConfig.showCharacterAvatar && characterAvatar">
        <div flex="~ col" class="justify-center items-end">
          <img class="w-25 h-25 shadow rounded" object="cover top" :src="characterAvatar">
          <span class="w-25" m="t-2" text="center gray-400">{{ curCharacter.name }}</span>
        </div>
      </template>
      <template v-else>
        <span class="dialog-name">{{ curCharacter.name }}</span>
      </template>
    </div>
    <div class="dialog-content col-span-9 text-left pr-24" :text="settings.storage.text.curFontSize">
      <PrintWords :speed="settings.storage.text.curSpeed" :words="curDialog.children[order].value" />
      <span class="typed-cursor">
        ▼
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { speak } from '@advjs/shared/speech'
import type { AdvConfig } from '@advjs/types'
import { adv } from '~/setup/adv'
import { useSettingsStore } from '~/stores/settings'
import { GameConfigKey } from '~/utils'

const gameConfig = inject<AdvConfig.GameConfig>(GameConfigKey)!

const advStore = adv.store

const settings = useSettingsStore()

const curDialog = computed(() => advStore.cur.dialog)

// 局部 words order，与全局 order 相区别
const order = ref(0)

watch(
  () => curDialog.value.children[order.value].value,
  (val) => {
    // 若开启了语音合成
    if (settings.storage.speech.enable) {
      speechSynthesis.cancel()
      speak(val, settings.storage.speech.language)
    }
  },
)

const next = () => {
  if (curDialog.value.children) {
    const length = curDialog.value.children.length

    if (order.value + 1 > length - 1) {
      if (adv.next())
        order.value = 0
    }
    else {
      order.value++
    }
  }
}

const curCharacter = computed(() => curDialog.value.character)

const characterAvatar = computed(() => {
  const curName = curCharacter.value ? curCharacter.value.name : ''
  const avatar = gameConfig.characters.find(item => item.name === curName || item.alias === curName || (Array.isArray(item.alias) && item.alias.includes(curName)))?.avatar
  const prefix = gameConfig.cdn.enable ? gameConfig.cdn.prefix || '' : ''
  return avatar ? prefix + avatar : ''
})
</script>

<style lang="scss">
.dialog-box {
  width: 100%;
  height: 40%;

  position: absolute;
  right: 0;
  bottom: -1px;

  background-image: linear-gradient(
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.9) 30%,
    black 100%
  );
  padding-top: 4rem;
}

.dialog-name {
  color: gray;
  font-size: 2rem;
}
.dialog-content {
  color: white;
  margin-top: 0.3rem;
}
</style>
