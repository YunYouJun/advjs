<script lang="ts" setup>
import type { AGUIPropertiesPanelProps } from './types'

import AGUIAccordionItem from '../accordion/AGUIAccordionItem.vue'
import AGUIPropertiesForm from './AGUIPropertiesForm.vue'

defineProps<{
  item: AGUIPropertiesPanelProps
}>()
</script>

<template>
  <AGUIAccordionItem :item="item">
    <AGUIPropertiesForm :properties="item.properties" />
  </AGUIAccordionItem>
</template>
