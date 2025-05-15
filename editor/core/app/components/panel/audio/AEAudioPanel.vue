<script setup lang="ts">
import { useAdvContext } from '@advjs/client'

const { $adv } = useAdvContext()

const audioStore = useAudioStore()
const app = useAppStore()
const fileStore = useFileStore()
const monacoStore = useMonacoStore()

async function fetchLibraryData() {
  if (!audioStore.bgmLibraryUrl) {
    return
  }

  fetch(audioStore.bgmLibraryUrl)
    .then(res => res.json())
    .then((data) => {
      audioStore.bgmLibraryData = data

      app.activeInspector = 'file'
      monacoStore.fileContent = JSON.stringify(data, null, 2)
      fileStore.fileName = audioStore.bgmLibraryUrl
    })
    .catch((err) => {
      console.error('Error fetching audio library:', err)
    })
}

function getAudioSrcByKey(bgmKey: string) {
  const cdnUrl = $adv.config.value.cdn.prefix || 'https://cos.advjs.yunle.fun'
  const bgmName = audioStore.bgmLibraryData[bgmKey]?.name
  return `${cdnUrl}/bgms/library/${bgmName}.mp3`
}
</script>

<template>
  <div class="h-full w-full p-4 text-white">
    <div>
      <t-form>
        <t-form-item label="背景音乐库" name="name">
          <t-input v-model="audioStore.bgmLibraryUrl" placeholder="https://xxx" size="small">
            <template #suffixIcon>
              <div class="i-ri-search-line cursor-pointer text-xs op-80 hover:op-100" @click="fetchLibraryData" />
            </template>
          </t-input>
        </t-form-item>
      </t-form>
    </div>

    <ul class="flex flex-col gap-2 py-4 pl-5 text-sm">
      <!-- @vue-expect-error i -->
      <li v-for="(item, key, i) in (audioStore.bgmLibraryData as any)" :key="key" class="relative">
        <div class="absolute w-5 text-right op-80 -left-6">
          {{ (i || 0) + 1 }}.
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <!-- <div class="i-ri-volume-up-line cursor-pointer text-$agui-c-text op-80 hover:op-100" @click="playAudio(key)" /> -->
            <span class="text-white font-bold">{{ key }}:</span>
            <span class="text-$agui-c-text">《{{ item.name }}》</span>
          </div>
          <audio
            :src="getAudioSrcByKey(key as any as string)"
            preload="metadata"
            controls
            class="w-full"
          />
          <span class="text-gray-400">{{ item.description }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
