<script setup lang="ts">
import type { AdvCharacterRelationship } from '@advjs/types'

const props = defineProps<{
  relationships?: AdvCharacterRelationship[]
}>()

const emit = defineEmits<{
  update: [relationships: AdvCharacterRelationship[]]
}>()

const list = ref<AdvCharacterRelationship[]>([...(props.relationships || [])])

const newRel = reactive<AdvCharacterRelationship>({
  targetId: '',
  type: '',
  description: '',
})

function addRelationship() {
  if (!newRel.targetId || !newRel.type)
    return

  list.value.push({ ...newRel })
  emit('update', [...list.value])
  newRel.targetId = ''
  newRel.type = ''
  newRel.description = ''
}

function removeRelationship(index: number) {
  list.value.splice(index, 1)
  emit('update', [...list.value])
}
</script>

<template>
  <div class="relationship-editor flex flex-col gap-3">
    <h3 class="text-sm font-bold op-60">
      Relationships
    </h3>

    <!-- Existing relationships -->
    <div v-if="list.length" class="flex flex-col gap-2">
      <div
        v-for="(rel, idx) in list"
        :key="idx"
        class="flex items-center gap-2 rounded bg-dark-400 p-2"
      >
        <span class="text-sm font-bold">{{ rel.targetId }}</span>
        <AGUITag theme="primary">
          {{ rel.type }}
        </AGUITag>
        <span v-if="rel.description" class="flex-1 text-xs op-60">{{ rel.description }}</span>
        <AGUIButton theme="danger" variant="text" icon="i-ri-close-line" @click="removeRelationship(idx)" />
      </div>
    </div>

    <div v-else class="text-sm op-40">
      No relationships
    </div>

    <!-- Add new relationship -->
    <div class="flex items-end gap-2">
      <div class="flex-1">
        <div class="mb-1 text-xs op-50">
          Target Character ID
        </div>
        <AGUIInput v-model="newRel.targetId" placeholder="Character ID" />
      </div>
      <div class="flex-1">
        <div class="mb-1 text-xs op-50">
          Relationship Type
        </div>
        <AGUIInput v-model="newRel.type" placeholder="e.g. 恋人, 宿敌" />
      </div>
      <div class="flex-1">
        <div class="mb-1 text-xs op-50">
          Description
        </div>
        <AGUIInput v-model="newRel.description" placeholder="Optional" />
      </div>
      <AGUIButton theme="primary" icon="i-ri-add-line" :disabled="!newRel.targetId || !newRel.type" @click="addRelationship" />
    </div>
  </div>
</template>
