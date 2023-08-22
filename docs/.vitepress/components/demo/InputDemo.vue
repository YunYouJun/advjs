<script lang="ts" setup>
import { ref } from 'vue'

const text = ref('Hello, World!')
</script>

<template>
  <AGUIDemoBlock title="Input Demo">
    <AGUIForm>
      <AGUIFormItem label="Default">
        <AGUIInput v-model="text" />
      </AGUIFormItem>

      <AGUIFormItem label="Disabled">
        <AGUIInput v-model="text" disabled />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
