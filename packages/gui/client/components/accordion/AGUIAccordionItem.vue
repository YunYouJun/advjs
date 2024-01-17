<script lang="ts" setup>
import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'radix-vue'
import './styles.scss'
import type { AGUIAccordionProps } from './types'

defineProps<{
  item: AGUIAccordionProps
}>()
</script>

<template>
  <AccordionItem
    class="AccordionItem"
    :value="item.value || item.title"
    :collapsible="item.collapsible"
  >
    <AccordionHeader class="AccordionHeader">
      <AccordionTrigger class="AccordionTrigger">
        <div class="AccordionChevron i-ep-caret-right mx-1" />
        <div :class="item.icon" class="AccordionIcon mr-1 text-xs" />
        <span class="text-xs">{{ item.title }}</span>
        <slot name="trigger" />
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent class="AccordionContent">
      <div class="AccordionContentText">
        <slot />
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
