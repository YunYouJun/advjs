<script setup lang="ts">
import { ref } from 'vue'

const value = ref(123)
</script>

<template>
  <AGUIDemoBlock title="NumberField">
    <AGUIProperty label="TOP">
      <AGUINumberField v-model="value" label="Demo value" location="TOP" />
    </AGUIProperty>

    <AGUIProperty label="MIDDLE">
      <AGUINumberField v-model="value" label="Demo value" location="MIDDLE" />
    </AGUIProperty>

    <AGUIProperty label="BOTTOM">
      <AGUINumberField v-model="value" label="Demo value" location="BOTTOM" />
    </AGUIProperty>
  </AGUIDemoBlock>
</template>
