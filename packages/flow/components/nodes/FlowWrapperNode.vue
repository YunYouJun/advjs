<!-- eslint-disable vue/no-mutating-props -->
<script lang="ts" setup>
// import type { DewNodeOptions, DewNodeStatus, InputsInterface, OutputsInterface } from '@stardew/kit/client'
import type { NodeProps } from '@vue-flow/core'
import type { CSSProperties } from 'vue'
// import type { FlowNodeStatus } from '../../types'
// import { getNodeCategoryColor, getNodeType } from '@stardew/flow'

import type { FlowNodeStatus } from '../../types'
// import { isDataHandleType, useGlobalFlowEditor } from '@stardew/kit/client'
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'

import { computed, ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { useGlobalFlowEditor } from '../../composables'

const props = defineProps<{
  class?: string
  node: NodeProps
  options?: {
    inputs?: Record<string, any>
    outputs?: Record<string, any>
    showStartEnd?: boolean
  }
}>()
const { emitter } = useGlobalFlowEditor()

const status = computed<FlowNodeStatus>(() => {
  return ''
})

// const { t, locale } = useI18n()
const { t } = useI18n()

const showHelp = ref(false)
const showSettings = ref(false)
// const showStartEnd = computed(() => props.options?.showStartEnd)

function toggleSettings() {
  showSettings.value = !showSettings.value
}
function toggleHelp() {
  showHelp.value = !showHelp.value
}

const containerRef = ref<HTMLElement>()
defineExpose({
  containerRef,
})

function onSelected() {
  emitter.emit('node-selected', props.node.id)
}

const showInputsOutputs = computed(() => {
  return Object.values(props.options?.inputs || {})
    .concat(Object.values(props.options?.outputs || {}))
    .some(v => v.showLabel !== false)
})

const color = computed(() => {
  // return getNodeCategoryColor(props.node.type)
  return ''
})
const headerBgStyles = computed<CSSProperties>(() => {
  return {
    '--c-primary': color.value || 'black',
    'backgroundColor': color.value || 'black',
  }
})

// const nodeType = getNodeType(props.node.type)!
// const nodeType = computed(() => {
//   return props.node.type
// })
const nodeTitle = computed(() => {
  // return props.node.label || nodeType.value.title || nodeType.value.locales?.[locale.value as 'zh-CN' | 'en'].title
  return props.node.label
})

const inputs = computed(() => {
  return Object.entries(props.options?.inputs || {})
    .sort((a, b) => (b[1].order || 0) - (a[1].order || 0))
    .map(([id, input]) => {
      return {
        id,
        input,
      }
    })
})
const outputs = computed(() => {
  return Object.entries(props.options?.outputs || {})
    .sort((a, b) => (b[1].order || 0) - (a[1].order || 0))
    .map(([id, output]) => {
      return {
        id,
        output,
      }
    })
})
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger>
      <div
        ref="containerRef"
        class="flow-wrapper-node min-w-52 cursor-auto rounded bg-$sd-c-bg-alt shadow outline-black outline"
        flex="~ col"
        :class="{
          'outline-white': status === 'running',
          'outline-red-500': status === 'error',
          'outline-blue-800 outline-dashed': node.selected,
          [props.class!]: !!props.class,
        }"
        @mousedown="onSelected"
      >
        <div
          class="px-2 py-1 text-10px"
          cursor="move"
          rounded="tl tr"
          flex items-center border="b-1px b-dark-50" op="95"
          :style="headerBgStyles"
        >
          <!-- <div v-if="status === 'running'" i-svg-spinners:3-dots-scale mr-1 />
          <div v-else-if="status === 'done'" i-ri-checkbox-circle-line mr-1 />
          <div v-else-if="status === 'error'" i-ri-error-warning-line mr-1 />
          <div v-else i-ri-git-commit-line mr-1 /> -->
          <div>
            {{ nodeTitle || t(`node.${props.node.type}`) }}
          </div>
          <slot name="after-title" />
          <div flex-grow />
          <!-- <div v-if="resetNode" op="80" hover="op-100" i-ri-refresh-line ml-1 cursor-pointer @click="resetNode" /> -->
          <!-- <div
            op="80" hover="op-100"
            alt="Remove Data" i-mdi-database-remove ml-1 cursor-pointer
            @click="resetData"
          /> -->
          <div flex>
            <!-- <div op="90" hover="op-100 shadow" i-ri-bug-line ml-1 cursor-pointer @click="consoleDebugData" /> -->
            <div v-if="$slots.help" op="90" hover="op-100 shadow" i-ri-question-line ml-1 cursor-pointer @click="toggleHelp" />
            <div v-if="$slots.settings" op="90" hover="op-100 shadow" i-ri-settings-line ml-1 cursor-pointer @click="toggleSettings" />
            <div
              i-ri-play-line op="90" hover="op-100 shadow" ml-1 cursor-pointer
              @click="() => {}"
            />

            <slot name="extended-actions" />
          </div>
        </div>

        <ElDialog v-model="showHelp" append-to-body title="Help">
          <slot name="help" />
        </ElDialog>

        <div v-if="showSettings" p="2" border="b gray-100 op-10" class="nodrag">
          <slot name="settings" />
        </div>

        <div
          bg="$sd-c-bg-alt"
          text-sm p="2" flex="~ col" gap="2"
          rounded="bl br"
        >
          <!-- <FlowWrapperNodeStartEnd v-if="showStartEnd" :color="color" /> -->
          <div v-if="showInputsOutputs" grid="~ cols-2">
            <div v-if="options && options.inputs">
              <template
                v-for="{ id, input } in inputs"
              >
                <FlowInputAction
                  v-if="input.type === 'action'"
                  :id="id" :key="id"
                  :input="input"
                />
                <!-- <FlowInputHandle
                  v-if="isDataHandleType(input.type)"
                  :id="id" :key="id"
                  :input="input"
                  :inputs="node.data.inputs"
                /> -->
              </template>
            </div>
            <div v-else />

            <div v-if="options && options.outputs">
              <template
                v-for="{ id, output } in outputs"
              >
                <FlowOutputAction
                  v-if="output.type === 'action'"
                  :id="id" :key="id"
                  :output="output"
                />
                <!-- <FlowOutputHandle
                  v-if="isDataHandleType(output.type)"
                  :id="id" :key="id"
                  :output="output"
                /> -->
              </template>
            </div>
            <div v-else />
          </div>

          <template v-else>
            <template
              v-for="{ id, input } in inputs"
            >
              <FlowInputAction
                v-if="input.type === 'action'"
                :id="id" :key="id"
                :input="input"
              />
              <!-- <FlowInputHandle
                v-if="isDataHandleType(input.type)"
                :id="id" :key="id"
                :input="input"
                :inputs="node.data.inputs"
              /> -->
            </template>
            <template
              v-for="{ id, output } in outputs"
            >
              <FlowOutputAction
                v-if="output.type === 'action'"
                :id="id" :key="id"
                :output="output"
              />
              <!-- <FlowOutputHandle
                v-if="isDataHandleType(output.type)"
                :id="id" :key="id"
                :output="output"
              /> -->
            </template>
          </template>
          <slot />
        </div>
      </div>
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <ContextMenuContent>
        <FlowNodeContextMenu :node="node" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style lang="scss">
.flow-wrapper-node {
  color: white;
}
</style>
