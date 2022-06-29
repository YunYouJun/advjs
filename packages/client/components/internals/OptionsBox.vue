<script lang="ts" setup>
import type { AdvAst } from '@advjs/types'

defineProps<{
  data: AdvAst.Choose
}>()

const emits = defineEmits<{
  (event: 'choose', choose: number): void
}>()
</script>

<template>
  <div
    flex="~ col"
    w="full"
    h="full"
    class="justify-center items-center"
  >
    <div v-for="(item, i) in data.choices" :key="i" @click="emits('choose', i)">
      {{ item.text }}
    </div>
  </div>
</template>

<style lang="scss">

</style>
