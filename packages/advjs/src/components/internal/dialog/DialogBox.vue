<template>
  <div class="dialog-box select-none" grid="~ cols-12" gap="12" @click="next">
    <div class="dialog-name col-span-3 text-right">
      <span v-if="curDialog.character">{{ curDialog.character.name }}</span>
    </div>
    <div class="dialog-content col-span-9 text-left pr-24">
      <TypedWords :words="curDialog.children[order].value" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { speak } from '@advjs/shared/speech'
import { adv } from '~/setup/adv'
import { useSettingsStore } from '~/stores/settings'

const advStore = adv.store

const settings = useSettingsStore()

const curDialog = computed(() => {
  return advStore.cur.dialog.value
})

// 局部 words order
const order = ref(0)

watch(
  () => curDialog.value.children[order.value].value,
  (val) => {
    // 若开启了语音合成
    if (settings.speech.options.enable) {
      speechSynthesis.cancel()
      speak(val, settings.speech.options.language)
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
  font-size: 1.5rem;
  margin-top: 0.3rem;
}
</style>
