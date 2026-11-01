<script setup lang="ts">
import type { PreviewScalar, PreviewVariableGroup } from './preview-types'
import AdvVariableField from './AdvVariableField.vue'

defineProps<{ groups: readonly PreviewVariableGroup[], disabled?: boolean, labels?: { unset?: string, invalidNumber?: string } }>()
const emit = defineEmits<{ change: [id: string, value: PreviewScalar | undefined] }>()
defineSlots<{
  header?: () => any
  boolean?: (props: Parameters<NonNullable<InstanceType<typeof AdvVariableField>['$slots']['boolean']>>[0]) => any
  select?: (props: Parameters<NonNullable<InstanceType<typeof AdvVariableField>['$slots']['select']>>[0]) => any
  unset?: (props: Parameters<NonNullable<InstanceType<typeof AdvVariableField>['$slots']['unset']>>[0]) => any
}>()
</script>

<template>
  <aside class="adv-variable-inspector">
    <slot name="header" />
    <component :is="group.expanded === undefined ? 'section' : 'details'" v-for="group in groups" :key="group.id" class="variable-group" :data-variable-group="group.id" :open="group.expanded">
      <component :is="group.expanded === undefined ? 'h4' : 'summary'">
        {{ group.label }}
      </component>
      <p v-if="group.description">
        {{ group.description }}
      </p>
      <AdvVariableField v-for="variable in group.variables" :key="variable.id" :variable="variable" :disabled="disabled" :labels="labels" @change="emit('change', variable.id, $event)">
        <template v-if="$slots.boolean" #boolean="slot">
          <slot name="boolean" v-bind="slot" />
        </template>
        <template v-if="$slots.select" #select="slot">
          <slot name="select" v-bind="slot" />
        </template>
        <template v-if="$slots.unset" #unset="slot">
          <slot name="unset" v-bind="slot" />
        </template>
      </AdvVariableField>
    </component>
  </aside>
</template>

<style scoped>
.adv-variable-inspector,
.variable-group {
  min-width: 0;
}
</style>
