<script lang="ts" setup>
import AGUIAccordionItem from '../accordion/AGUIAccordionItem.vue'

import type { AGUIPropertiesPanelProps } from './types'
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
