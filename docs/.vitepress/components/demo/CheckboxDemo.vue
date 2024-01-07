<script lang="ts" setup>
import { ref } from 'vue'

const checked1 = ref(false)
const checked2 = ref(true)
</script>

<template>
  <AGUIDemoBlock title="Checkbox Demo">
    <AGUIForm>
      <AGUIFormItem label="Default">
        <AGUICheckbox v-model:checked="checked1" />
      </AGUIFormItem>
      <AGUIFormItem label="Checked" description="Checked Checkbox">
        <AGUICheckbox v-model:checked="checked2" />
      </AGUIFormItem>
      <AGUIFormItem label="Disabled">
        <AGUICheckbox v-model:checked="checked1" disabled />
      </AGUIFormItem>
      <AGUIFormItem label="Disabled">
        <AGUICheckbox v-model:checked="checked2" disabled />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
