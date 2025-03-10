<script lang="ts" setup>
import type { AccordionRootProps } from 'radix-vue'
import type { PropType } from 'vue'
import type { AGUIAccordionProps } from './types'
import { AccordionRoot } from 'radix-vue'

import AGUIAccordionItem from './AGUIAccordionItem.vue'

import './styles.scss'

withDefaults(
  defineProps<{
    items?: AGUIAccordionProps[]
  } & Partial<AccordionRootProps>>(),
  {
    type: 'single',
  },
)

const modelValue = defineModel('modelValue', {
  type: [String, Array] as PropType<string | string[]>,
  default: () => [],
})
</script>

<template>
  <AccordionRoot
    v-bind="$props"
    :model-value="modelValue"
    class="AccordionRoot"
    collapsible
    :type="type"
    @update:model-value="value => modelValue = value ?? []"
  >
    <template v-if="items">
      <template v-for="item in items" :key="item.title">
        <AGUIAccordionItem :item="item" />
      </template>
    </template>
    <slot />
  </AccordionRoot>
</template>
