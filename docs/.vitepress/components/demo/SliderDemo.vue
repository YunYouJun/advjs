<script lang="ts" setup>
import { ref } from 'vue'

const num = ref(0)
</script>

<template>
  <AGUIDemoBlock title="Slider Demo">
    <AGUIForm>
      <AGUIFormItem label="Default">
        <AGUISlider v-model="num" />
      </AGUIFormItem>
      <AGUIFormItem label="With Input (Todo)" description="Slider + Input">
        <AGUISlider v-model="num" disabled show-input />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
