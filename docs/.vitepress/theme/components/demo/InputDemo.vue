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

      <AGUIFormItem label="Prefix Icon">
        <AGUIInput v-model="text" prefix-icon="i-ri-search-line" />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
