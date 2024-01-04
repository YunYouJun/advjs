<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue'

import Option from './AGUISelectOption.vue'

type OptionType = string | { value: string, label?: string, icon?: string }

const props = defineProps<{
  modelValue?: string
  options: OptionType[]
  legend?: string
}>()

// 使用 emits 定义组件发出的事件
const emit = defineEmits(['change', 'update:modelValue'])

const current = computed(() => {
  return props.options?.find((option) => {
    if (typeof option === 'string')
      return option === props.modelValue

    return option.value === props.modelValue
  })
})

const expanded = ref<undefined | { x: 'LEFT' | 'RIGHT', y: 'UP' | 'DOWN' }>()
let timer: number | undefined

// 选择选项的逻辑
function select(next: OptionType) {
  const newValue = typeof next === 'string' ? next : next.value
  emit('change', newValue)
  emit('update:modelValue', newValue)
  collapse()
}

// 展开选项的逻辑
function expand() {
  expanded.value = {
    x: 'LEFT',
    y: 'DOWN',
  }
  nextTick().then(() => {
    if (!expanded.value)
      return

    const el = ref<HTMLElement | null>(null)
    const bounds = el.value?.getBoundingClientRect()
    if (!bounds)
      return
    const { x, y, height } = bounds
    const { innerHeight } = window
    if (x < 0)
      expanded.value.x = 'RIGHT'

    if (y + height > innerHeight)
      expanded.value.y = 'UP'
  })
}

// 收起选项的逻辑
function collapse() {
  expanded.value = undefined
}

// 鼠标离开时的逻辑
function onLeave() {
  timer = window.setTimeout(collapse, 0)
}

// 鼠标进入时的逻辑
function onEnter() {
  clearTimeout(timer)
  timer = undefined
}

const el = ref<HTMLElement | null>(null)
</script>

<template>
  <div
    class="search-field agui-select relative"
    :class="{
      expanded,
      up: expanded?.y === 'UP',
      right: expanded?.x === 'RIGHT',
      down: expanded?.y === 'DOWN',
      left: expanded?.x === 'LEFT',
    }"
  >
    <button class="value" @click="expand">
      <span v-if="typeof current === 'string'">{{ current }}</span>
      <template v-else-if="current">
        <span
          v-if="current.icon"
          class="icon"
          :style="`background-image: var(--b-icon-${current.icon})`"
        />
        <span>{{ current.label ?? current.value }}</span>
      </template>
    </button>
    <div v-if="expanded" ref="el" class="popout">
      <button class="detector" @mouseleave="onLeave" @click="collapse" />
      <div class="options" @mouseenter="onEnter">
        <template v-for="option in options">
          <Option
            v-if="typeof option === 'string'"
            :key="option"
            :value="option"
            :label="option"
            @click="() => select(option)"
          />
          <Option
            v-else
            :key="option.value"
            :value="option.value"
            :icon="option.icon"
            :label="option.label ?? option.value"
            @click="() => select(option)"
          />
        </template>
      </div>
      <div v-if="legend" class="legend" @mouseenter="onEnter">
        {{ legend }}
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.agui-select {
  position: relative;

  flex-grow: 1;
  display: flex;
  flex-direction: column;

  outline: none;

  .value {
    font:
      12px system-ui,
      sans-serif;
    appearance: none;
    background-color: transparent;
    border: none;
    box-sizing: border-box;
    width: 100%;
    color: #fdfdfd;
    outline: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 20px 0 4px;
    background: #1d1d1d;
    border: 1px solid #3d3d3d;
    box-shadow: 0 1px 3px rgba(black, 0.3);
    border-radius: 4px;
    text-align: left;
    min-height: 18px;
    cursor: pointer;

    &:hover {
      background: #232323;
      border-color: #414141;
    }

    &:after {
      content: '';
      position: absolute;
      top: 1px;
      right: 3px;
      width: 16px;
      height: 16px;
      background: var(--b-icon-chevron-down) center center no-repeat;
      opacity: 0.5;
    }
    .expanded & {
      background: #446290;
      color: #ffffff;
    }
    .expanded.up & {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-top-color: #446290;
    }
    .expanded.down & {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: #446290;
    }
  }
  .icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    background: no-repeat center center;
    background-size: contain;
  }
  .popout {
    position: absolute;
    top: 100%;
    z-index: 10;
    box-sizing: border-box;
    min-width: 100%;
    background: #181818;
    border: 1px solid #242424;
    border-radius: 4px;

    outline: none !important;

    .up & {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      bottom: 100%;
    }
    .right & {
      left: 0;
    }
    .down & {
      top: 100%;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
    }
    .left & {
      right: 0;
    }
  }
  .detector {
    position: absolute;
    top: -32px;
    right: -32px;
    bottom: -32px;
    left: -32px;
    background-color: transparent;
    border: none;
  }

  .options {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px;

    align-items: start;
  }

  .legend {
    position: relative;
    color: #989898;
    padding: 5px 8px 4px 8px;
    .down & {
      border-top: 1px solid #2f2f2f;
    }
  }
}
</style>
