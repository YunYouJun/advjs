<script lang="ts" setup>
import { ref } from 'vue'

const value = ref(50)
</script>

<template>
  <AGUIDemoBlock title="Number Slider">
    <AGUIProperty label="default">
      <AGUINumberSlider v-model="value" :step="1" :min="0" :max="100" />
    </AGUIProperty>

    <AGUIProperty
      label="Min Max"
    >
      <AGUINumberSlider v-model="value" :step="1" :min="0" :max="100" />
    </AGUIProperty>

    <AGUIProperty
      label="Title"
    >
      <AGUINumberSlider v-model="value" title="Title" :step="1" :min="0" :max="100" />
    </AGUIProperty>
  </AGUIDemoBlock>
</template>
