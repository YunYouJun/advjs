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
import '../input/fields.scss'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  options?: string[]
  placeholder?: string
  clearable?: boolean
  id?: string
  label?: string
  disabled?: boolean
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
    class="agui-combobox"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="onUpdateModelValue"
  >
    <ComboboxAnchor class="agui-combobox-wrapper">
      <ComboboxInput
        v-bind="$attrs"
        :id="id"
        :aria-label="label || ($attrs['aria-label'] as string | undefined)"
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
  min-width: 0;
  width: 100%;
}
.agui-combobox {
  min-width: 0;
  width: 100%;
}

.agui-combobox-content {
  font-family: var(--agui-font-family-ui);
  overflow: hidden;
  color: var(--agui-c-text-1);
  background-color: var(--agui-c-popup);
  border: 1px solid var(--agui-c-border);
  border-radius: var(--agui-radius-md);
  box-shadow: var(--agui-shadow-popup);
  width: var(--reka-combobox-trigger-width);
  max-height: var(--reka-combobox-content-available-height);
}

.agui-combobox-viewport {
  padding: var(--agui-space-1);
}

.agui-combobox-empty {
  padding: var(--agui-space-1) var(--agui-control-padding-x);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-control-line-height);
  color: var(--agui-c-text-2);
}

.agui-combobox-item {
  box-sizing: border-box;
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-control-line-height);
  border-radius: var(--agui-radius-sm);
  display: flex;
  align-items: center;
  min-height: var(--agui-control-height);
  padding: 2px var(--agui-control-padding-x) 2px var(--agui-control-height);
  position: relative;
  user-select: none;

  &[data-disabled] {
    color: var(--agui-c-text-3);
    pointer-events: none;
  }
  &[data-highlighted] {
    outline: none;
    background-color: var(--agui-c-selection);
    color: var(--agui-c-selection-text);
    cursor: pointer;
  }
  &:hover:not([data-disabled]) {
    background-color: var(--agui-c-item-hover);
    color: var(--agui-c-text-1);
  }
  &:active:not([data-disabled]) {
    background-color: var(--agui-c-item-pressed);
  }
  &[data-state='checked'] {
    background-color: var(--agui-c-selection);
    color: var(--agui-c-selection-text);
  }

  &-indicator > div {
    width: var(--agui-icon-size);
    height: var(--agui-icon-size);
  }

  &-indicator {
    position: absolute;
    left: 0;
    width: var(--agui-control-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
