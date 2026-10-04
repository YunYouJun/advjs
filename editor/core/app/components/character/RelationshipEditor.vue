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
      {{ $t('characters.detail.relationships') }}
    </h3>

    <!-- Existing relationships -->
    <div v-if="list.length" class="flex flex-col gap-2">
      <div
        v-for="(rel, idx) in list"
        :key="idx"
        class="p-2 rounded bg-dark-400 flex gap-2 items-center"
      >
        <span class="text-sm font-bold">{{ rel.targetId }}</span>
        <AGUITag theme="primary">
          {{ rel.type }}
        </AGUITag>
        <span v-if="rel.description" class="text-xs op-60 flex-1">{{ rel.description }}</span>
        <AGUIButton theme="danger" variant="text" icon="i-ri-close-line" @click="removeRelationship(idx)" />
      </div>
    </div>

    <div v-else class="text-sm op-40">
      {{ $t('characters.relationship.empty') }}
    </div>

    <!-- Add new relationship -->
    <div class="flex gap-2 items-end">
      <div class="flex-1">
        <div class="text-xs mb-1 op-50">
          {{ $t('characters.relationship.target') }}
        </div>
        <AGUIInput v-model="newRel.targetId" :placeholder="$t('characters.form.id')" />
      </div>
      <div class="flex-1">
        <div class="text-xs mb-1 op-50">
          {{ $t('characters.relationship.type') }}
        </div>
        <AGUIInput v-model="newRel.type" :placeholder="$t('characters.relationship.typePlaceholder')" />
      </div>
      <div class="flex-1">
        <div class="text-xs mb-1 op-50">
          {{ $t('characters.relationship.description') }}
        </div>
        <AGUIInput v-model="newRel.description" :placeholder="$t('common.optional')" />
      </div>
      <AGUIButton theme="primary" icon="i-ri-add-line" :disabled="!newRel.targetId || !newRel.type" @click="addRelationship" />
    </div>
  </div>
</template>
