<script setup lang="ts">
import type { StageStatus } from '../../../packages/webcontainer/src/index'

import { isClient } from '@vueuse/core'

import { consola } from 'consola'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { useAdvWebContainer } from '../../../packages/webcontainer/src/index'

import '@xterm/xterm/css/xterm.css'

const { t } = useI18n()

const isLoading = ref(false)

const route = useRoute()

const terminalElRef = ref<HTMLElement>()
const {
  webContainerRef,
  installDependencies,
  build,
  mount,
  state,
  downloadIndexHtml,
  initTerminal,
} = useAdvWebContainer({
  storyId: route.query.pominisId as string,
})

/**
 * 当前状态描述
 */
const curStatusDesc = computed(() => {
  if (state.value.build === 'done') {
    return t('webcontainer.status.ready')
  }
  else if (state.value.installDependencies === 'done') {
    return t('webcontainer.status.building')
  }
  else if (state.value.mount === 'done') {
    return t('webcontainer.status.installing')
  }
  else {
    return t('webcontainer.status.mounting')
  }
})

const terminalStatus = ref<StageStatus>('')

const statusList = computed<{
  status: StageStatus
  desc: string
}[]>(() => {
  return [
    {
      status: state.value.mount,
      desc: t('webcontainer.step.mount'),
    },
    {
      status: terminalStatus.value,
      desc: t('webcontainer.step.start'),
    },
    {
      status: state.value.installDependencies,
      desc: t('webcontainer.step.install-dependencies'),
    },
    {
      status: state.value.build,
      desc: t('webcontainer.step.build'),
    },
  ]
})

const playStore = usePlayStore()
const pominisStore = usePominisStore()

onMounted(async () => {
  consola.info('mounted')

  const query = route.query
  const pominisId = query.pominisId as string | undefined
  if (pominisId) {
    playStore.curAdapter = 'pominis'

    const token = query.token as string | undefined
    const data = await pominisStore.fetchPominisStory({
      id: pominisId,
      token,
    })
    if (data.title) {
      route.meta.title = data.title
    }
  }

  if (isClient) {
    consola.info('Mounting WebContainer...')
    await mount()

    terminalStatus.value = 'running'
    consola.info('Init Terminal')
    await initTerminal(terminalElRef.value)
    terminalStatus.value = 'done'

    if (!webContainerRef.value) {
      consola.error('WebContainer is not initialized')
      return
    }

    const packageJSON = await webContainerRef.value.fs.readFile(
      'package.json',
      'utf-8',
    )
    consola.info(packageJSON)
  }
})

async function installAndBuild() {
  await installDependencies()
  await build()
}
</script>

<template>
  <div>
    <div
      v-if="isLoading"
      class="fixed size-full bg-black/80"
      flex="~" justify="center" items="center"
      z="99999"
    >
      <div i-svg-spinners:blocks-shuffle-2 class="text-8xl" />
      <div>
        {{ curStatusDesc }}
      </div>
    </div>

    <div class="flex justify-between">
      <div class="flex flex-col gap-1 p-2">
        <h3 class="text-lg font-bold">
          {{ t('webcontainer.status-title') }}

          「{{ pominisStore.curPominisStory?.title }}」
        </h3>

        <div class="flex flex-col">
          <span v-for="status in statusList" :key="status.status" class="flex items-center gap-2 text-sm">
            <div v-if="status.status === 'running'" class="i-svg-spinners:3-dots-scale" />
            <div v-else-if="status.status === 'done'" class="i-ri-check-line text-green-500" />
            <div v-else class="i-ri-circle-line op-0" />

            <span>
              {{ status.desc }}
            </span>
          </span>
        </div>
      </div>

      <div class="actions flex">
        <AdvButton
          class="flex items-center justify-center gap-4"
          :disabled="state.mount === 'running' || state.installDependencies === 'running' || state.build === 'running'"
          @click="installAndBuild()"
        >
          <div v-if="state.installDependencies === 'running' || state.build === 'running'" i-svg-spinners:blocks-shuffle-2 />
          {{ t('webcontainer.install-and-build') }}
        </AdvButton>

        <TooltipProvider />

        <AdvButton v-if="state.build === 'done'" @click="downloadIndexHtml()">
          {{ t('webcontainer.download') }}
        </AdvButton>

        <TooltipProvider
          v-else
          :delay-duration="0"
        >
          <TooltipRoot>
            <TooltipTrigger as="template">
              <AdvButton disabled>
                {{ t('webcontainer.download') }}
              </AdvButton>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                class="data-[state=instant-open]:data-[side=top]:animate-slideDownAndFade data-[state=instant-open]:data-[side=right]:animate-slideLeftAndFade data-[state=instant-open]:data-[side=left]:animate-slideRightAndFade data-[state=instant-open]:data-[side=bottom]:animate-slideUpAndFade text-grass11 will-change-[transform,opacity] select-none border rounded-md bg-dark px-[15px] py-[10px] text-sm leading-none shadow-sm"
              >
                {{ t('webcontainer.download-disabled-tip') }}
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </TooltipProvider>
      </div>
    </div>

    <div ref="terminalElRef" class="terminal" />
  </div>
</template>

<style>
.terminal {
  background-color: black;
  padding: 4px;
  border-radius: 4px;
  overflow: hidden;
}
</style>
