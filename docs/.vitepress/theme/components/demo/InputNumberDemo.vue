<script lang="ts" setup>
import type { Vector2, Vector3 } from '@advjs/gui'
import { ref } from 'vue'

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
        <AGUIInputNumber v-model="num" aria-label="Number" />
      </AGUIFormItem>

      <AGUIFormItem label="Min 0 Max 180">
        <AGUIInputNumber v-model="num" aria-label="Number" :min="0" :max="180" />
      </AGUIFormItem>

      <AGUIFormItem label="Vector2">
        <AGUIInputVector v-model="vector2" label="Demo value" />
      </AGUIFormItem>

      <AGUIFormItem label="Vector3">
        <AGUIInputVector v-model="vector3" label="Demo value" />
      </AGUIFormItem>

      <AGUIFormItem label="Custom Label">
        <AGUIInputVector label="Demo value" />
        <AGUIInputVector label="Demo value" />
      </AGUIFormItem>
    </AGUIForm>
  </AGUIDemoBlock>
</template>
