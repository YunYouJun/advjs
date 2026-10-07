<script setup lang="ts">
import type { AdvMenuItemKeys, AdvMenuItemProps } from '@advjs/client'
import { useId } from 'vue'

withDefaults(defineProps<{
  // todo optimize
  item?: AdvMenuItemProps<AdvMenuItemKeys, any>
}>(), {
  item: () => {
    const defaultMenuItemProps: AdvMenuItemProps = {
      label: 'Label',
      type: 'Checkbox',
      props: {
        checked: false,
      },
    }
    return defaultMenuItemProps
  },
})
const controlId = useId()
</script>

<template>
  <div class="adv-menu-item--label">
    <label :id="`${controlId}-label`" :for="controlId">{{ item.label }}</label>
  </div>
  <div class="adv-menu-item--container">
    <AdvCheckbox v-if="item.type === 'Checkbox'" :id="controlId" :aria-labelledby="`${controlId}-label`" :props="item.props" />
    <AdvRadioGroup v-else-if="item.type === 'RadioGroup'" :aria-labelledby="`${controlId}-label`" :props="item.props" />
    <AdvSelect v-else-if="item.type === 'Select'" :id="controlId" :aria-labelledby="`${controlId}-label`" :props="item.props" />
    <!-- The item contract deliberately supplies a writable settings ref. -->
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <AdvSlider v-else-if="item.type === 'Slider'" v-bind="item.props" :id="controlId" v-model="item.props.modelValue.value" :label="item.label" :show-label="false" />
    <slot v-else />
  </div>
</template>
