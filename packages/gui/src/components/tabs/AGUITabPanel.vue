<script lang="ts" setup>
import { TabPanel } from '@headlessui/vue'

const props = defineProps<{
  unmount?: boolean
}>()
</script>

<template>
  <TabPanel class="text-sm text-white" v-bind="props">
    <slot />
  </TabPanel>
</template>
