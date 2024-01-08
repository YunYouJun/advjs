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
  <AGUIDemoBlock title="Checkbox Label Demo">
    <AGUIForm>
      <AGUICheckbox v-model:checked="checked1" label="Label" />
      <AGUICheckbox v-model:checked="checked2" label="Label (Checked)" />
      <AGUICheckbox v-model:checked="checked1" disabled label="Label (Disabled)" />
      <AGUICheckbox v-model:checked="checked2" disabled label="Label (Checked, Disabled)" />
    </AGUIForm>
  </AGUIDemoBlock>
</template>
