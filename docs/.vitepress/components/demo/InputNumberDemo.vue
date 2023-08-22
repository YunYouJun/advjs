<script lang="ts" setup>
import { ref } from 'vue'
import type { Vector2, Vector3 } from '../../../../packages/gui/src'

const num = ref(6)

const vector2 = ref<Vector2>({
  x: 0,
  y: 0,
})

const vector3 = ref<Vector3>({
  x: 0,
  y: 0,
  z: 0,
})
</script>

<template>
  <AGUIDemoBlock title="Input Demo">
    <AGUIForm>
      <AGUIFormItem label="Number">
        <AGUIInputNumber v-model="num" />
      </AGUIFormItem>

      <AGUIFormItem label="Min 0 Max 180">
        <AGUIInputNumber v-model="num" :min="0" :max="180" />
      </AGUIFormItem>

      <AGUIFormItem label="Vector2">
        <AGUIInputVector v-model="vector2" />
      </AGUIFormItem>

      <AGUIFormItem label="Vector3">
        <AGUIInputVector v-model="vector3" />
      </AGUIFormItem>

      <AGUIFormItem label="Custom Label">
        <AGUIInputVector />
        <AGUIInputVector />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
