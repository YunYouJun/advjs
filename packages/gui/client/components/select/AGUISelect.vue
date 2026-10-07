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
import { computed } from 'vue'

type OptionType = string | { value: string | number, label?: string, icon?: string }

const props = defineProps<{
  modelValue?: string | number
  options: OptionType[]
  legend?: string
  label?: string
  disabled?: boolean

  placeholder?: string

  /**
   * @description 是否多选
   */
  multiple?: boolean
}>()

// 使用 emits 定义组件发出的事件
const emit = defineEmits(['change', 'update:modelValue'])

const selectedLabel = computed(() => {
  const option = props.options.find(option => (typeof option === 'string' ? option : option.value) === props.modelValue)
  return typeof option === 'string' ? option : option ? option.label ?? String(option.value) : undefined
})

function onUpdateModelValue(value: AcceptableValue) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :multiple="multiple"
    :disabled="disabled"
    @update:model-value="onUpdateModelValue"
  >
    <SelectTrigger
      class="agui-select-trigger"
      :aria-label="label || placeholder"
      :title="multiple ? undefined : selectedLabel"
    >
      <SelectValue v-if="!multiple && selectedLabel !== undefined" :placeholder="placeholder">
        {{ selectedLabel }}
      </SelectValue>
      <SelectValue v-else :placeholder="placeholder" />
      <div class="i-radix-icons:chevron-down" op="60" />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="agui-select-content z-100"
        side="bottom"
      >
        <SelectScrollUpButton class="agui-select-scroll-button">
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

        <SelectScrollDownButton class="agui-select-scroll-button">
          <div class="i-radix-icons:chevron-down" />
        </SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style lang="scss">
.agui-select-trigger {
  font: inherit;
  font-size: 13px;
  appearance: none;
  box-sizing: border-box;
  width: 100%;
  color: var(--agui-c-text-1);
  display: inline-flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-control-border);
  border-radius: 2px;
  text-align: left;
  min-height: var(--agui-control-height);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: 1px;
  }
  &:hover:not(:disabled) {
    border-color: var(--agui-c-border-hover);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &[data-placeholder] {
    color: var(--agui-c-text-2);
  }
  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.agui-select-content {
  overflow: hidden;
  color: var(--agui-c-text-1);
  background: var(--agui-c-popup);
  border: 1px solid var(--agui-c-border);
  border-radius: 4px;
  box-shadow: var(--agui-shadow-popup);
}
.agui-select-viewport {
  padding: 4px;
}
.agui-select-item {
  font-size: 12px;
  line-height: 1.4;
  border-radius: 2px;
  display: flex;
  align-items: center;
  min-height: 25px;
  padding: 0 24px;
  position: relative;
  user-select: none;

  &[data-disabled] {
    color: var(--agui-c-text-3);
    pointer-events: none;
  }
  &[data-highlighted] {
    outline: none;
    background: var(--agui-c-active);
    color: var(--agui-c-on-accent);
    cursor: pointer;
  }
  &-indicator {
    position: absolute;
    left: 0;
    width: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
.agui-select-scroll-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  color: var(--agui-c-text-2);
  background: var(--agui-c-popup);
  cursor: default;
}
</style>
