<script lang="ts" setup>
import type {
  AcceptableValue,
} from 'reka-ui'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  // SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  // SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

type OptionType = string | { value: string | number, label?: string, icon?: string }

defineProps<{
  modelValue?: string | number
  options: OptionType[]
  legend?: string

  placeholder?: string

  /**
   * @description 是否多选
   */
  multiple?: boolean
}>()

// 使用 emits 定义组件发出的事件
const emit = defineEmits(['change', 'update:modelValue'])

function onUpdateModelValue(value: AcceptableValue) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :multiple="multiple"
    @update:model-value="onUpdateModelValue"
  >
    <SelectTrigger
      class="agui-select-trigger"
      :aria-label="placeholder"
    >
      <SelectValue :placeholder="placeholder" />
      <div class="i-radix-icons:chevron-down" op="60" />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="agui-select-content z-100"
        side="bottom"
      >
        <SelectScrollUpButton class="SelectScrollButton">
          <div class="i-radix-icons:chevron-up" />
        </SelectScrollUpButton>

        <SelectViewport class="agui-select-viewport">
          <!-- <SelectLabel class="SelectLabel">
            Fruits
          </SelectLabel> -->
          <SelectGroup v-if="Array.isArray(options)">
            <template
              v-for="(option, index) in options"
            >
              <SelectItem
                v-if="(typeof option === 'string')"
                :key="index"
                class="agui-select-item"
                :value="option"
              >
                <SelectItemIndicator class="agui-select-item-indicator">
                  <div class="i-radix-icons:check" />
                </SelectItemIndicator>
                <SelectItemText>
                  {{ option }}
                </SelectItemText>
              </SelectItem>
              <SelectItem
                v-else
                :key="option.value"
                class="agui-select-item"
                :value="option.value"
              >
                <SelectItemIndicator class="agui-select-item-indicator">
                  <div class="i-radix-icons:check" />
                </SelectItemIndicator>
                <div mr-1 :class="option.icon" />
                <SelectItemText>
                  {{ option.label }}
                </SelectItemText>
              </SelectItem>
            </template>
          </SelectGroup>
        </SelectViewport>

        <SelectScrollDownButton class="SelectScrollButton agui-select-scroll-button">
          <div class="i-radix-icons:chevron-down" />
        </SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style lang="scss">
.agui-select-trigger {
  font:
    12px system-ui,
    sans-serif;
  appearance: none;
  background-color: transparent;
  box-sizing: border-box;
  width: 100%;
  color: #fdfdfd;
  outline: none;

  display: inline-flex;
  justify-content: space-between;
  align-items: center;

  gap: 4px;
  padding: 0 4px 0 4px;

  background: #1d1d1d;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(black, 0.3);
  border-radius: 4px;
  text-align: left;
  min-height: 20px;
  cursor: pointer;

  &:focus {
    outline: none;
  }

  &:hover {
    background-color: #232323;
  }

  &[data-placeholder] {
    color: var(--agui-c-text-1);
  }
}

.agui-select-content {
  overflow: hidden;
  background-color: #1d1d1d;
  border-radius: 6px;
  box-shadow:
    0px 10px 38px -10px rgba(22, 23, 24, 0.35),
    0px 10px 20px -15px rgba(22, 23, 24, 0.2);
}

.agui-select-viewport {
  padding: 5px;
}

.agui-select-item {
  font-size: 12px;
  line-height: 1;
  border-radius: 3px;
  display: flex;
  align-items: center;
  height: 20px;
  padding: 0 35px 0 25px;
  position: relative;
  user-select: none;

  &[data-disabled] {
    color: #aaa;
    pointer-events: none;
  }
  &[data-highlighted] {
    outline: none;
    background-color: var(--agui-c-active);
    color: white;
    cursor: pointer;
  }

  &-indicator {
    position: absolute;
    left: 0;
    width: 25px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

.SelectLabel {
  padding: 0 8px;
  font-size: 9px;
  line-height: 25px;
  color: #989898;
}

.SelectSeparator {
  height: 1px;
  background-color: var(--agui-c-divider);
  margin: 5px;
}

.SelectScrollButton {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 25px;
  background-color: white;
  color: #989898;
  cursor: default;
}
</style>
