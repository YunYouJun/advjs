<script lang="ts" setup>
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxViewport,
} from 'reka-ui'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  options?: string[]
  placeholder?: string
  clearable?: boolean
}>(), {
  options: () => [],
})

const emit = defineEmits(['update:modelValue'])

const filteredOptions = computed(() => {
  const term = (props.modelValue || '').toLowerCase()
  if (!term)
    return props.options
  return props.options.filter(option =>
    option.toLowerCase().includes(term),
  )
})

function onUpdateModelValue(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <ComboboxRoot
    :model-value="modelValue"
    @update:model-value="onUpdateModelValue"
  >
    <ComboboxAnchor class="agui-combobox-wrapper">
      <ComboboxInput
        :model-value="modelValue"
        :display-value="(v: string) => v ?? ''"
        class="agui-combobox-input agui-input"
        :placeholder="placeholder"
        auto-focus
        @update:model-value="onUpdateModelValue"
      />
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent class="agui-combobox-content z-100" position="popper" :side-offset="4">
        <ComboboxViewport class="agui-combobox-viewport">
          <ComboboxEmpty class="agui-combobox-empty">
            No results
          </ComboboxEmpty>

          <ComboboxItem
            v-for="option in filteredOptions"
            :key="option"
            class="agui-combobox-item"
            :value="option"
          >
            <ComboboxItemIndicator class="agui-combobox-item-indicator">
              <div class="i-radix-icons:check" />
            </ComboboxItemIndicator>
            <span class="agui-combobox-item-text">
              {{ option }}
            </span>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<style lang="scss">
.agui-combobox-wrapper {
  width: 100%;
}

.agui-combobox-input {
  width: 100%;
  padding: 0 4px;
  box-sizing: border-box;
}

.agui-combobox-content {
  overflow: hidden;
  color: var(--agui-c-text-1);
  background-color: var(--agui-c-popup);
  border: 1px solid var(--agui-c-border);
  border-radius: 4px;
  box-shadow: var(--agui-shadow-popup);
  width: var(--reka-combobox-trigger-width);
  max-height: var(--reka-combobox-content-available-height);
}

.agui-combobox-viewport {
  padding: 5px;
}

.agui-combobox-empty {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--agui-c-text-2);
}

.agui-combobox-item {
  font-size: 12px;
  line-height: 1;
  border-radius: 3px;
  display: flex;
  align-items: center;
  min-height: 25px;
  padding: 0 35px 0 25px;
  position: relative;
  user-select: none;

  &[data-disabled] {
    color: var(--agui-c-text-3);
    pointer-events: none;
  }
  &[data-highlighted] {
    outline: none;
    background-color: var(--agui-c-active);
    color: var(--agui-c-on-accent);
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
</style>
