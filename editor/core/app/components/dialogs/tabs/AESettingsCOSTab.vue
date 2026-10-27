<script setup lang="ts">
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'

const id = useId()
const name = ref('Pedro Duarte')
const username = ref('@peduarte')
</script>

<template>
  <AGUIForm padded>
    <AGUIFormItem :for="`${id}-name`" label="Name">
      <AGUIInput :id="`${id}-name`" v-model="name" />
    </AGUIFormItem>
    <AGUIFormItem :for="`${id}-username`" label="Username">
      <AGUIInput :id="`${id}-username`" v-model="username" />
    </AGUIFormItem>
  </AGUIForm>
</template>
