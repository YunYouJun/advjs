<script lang="ts" setup>
import { ref } from 'vue'

const curOption = ref('None')
const options = ['None', 'Back', 'Front', 'Both']
</script>

<template>
  <AGUIDemoBlock title="Slider Demo">
    <AGUIForm>
      <AGUIFormItem label="Default Select">
        <AGUISelect v-model="curOption" :options="options" />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
