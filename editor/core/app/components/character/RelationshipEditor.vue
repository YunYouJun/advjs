<script setup lang="ts">
import type { AdvCharacterRelationship } from '@advjs/types'
import { computed, reactive, useId } from 'vue'
import '../../styles/resource-panel.scss'

const props = defineProps<{ relationships?: AdvCharacterRelationship[] }>()
const emit = defineEmits<{ update: [relationships: AdvCharacterRelationship[]] }>()
const fieldId = useId()
const newRel = reactive({ targetId: '', type: '', description: '' })
const canAdd = computed(() => !!newRel.targetId.trim() && !!newRel.type.trim())
function addRelationship() {
  if (!canAdd.value)
    return
  emit('update', [...(props.relationships ?? []), {
    targetId: newRel.targetId.trim(),
    type: newRel.type.trim(),
    description: newRel.description.trim(),
  }])
  Object.assign(newRel, { targetId: '', type: '', description: '' })
}
function removeRelationship(index: number) {
  emit('update', (props.relationships ?? []).filter((_, i) => i !== index))
}
</script>

<template>
  <AGUIDetails class="ae-resource-panel" :title="$t('characters.detail.relationships')" open>
    <ul v-if="relationships?.length" class="ae-resource-list">
      <li v-for="(rel, idx) in relationships" :key="idx" class="ae-resource-row">
        <div class="ae-resource-meta">
          <div class="ae-resource-name">
            {{ rel.targetId }} · {{ rel.type }}
          </div>
          <div v-if="rel.description" class="ae-resource-caption">
            {{ rel.description }}
          </div>
        </div>
        <AGUIIconButton icon="i-ri-close-line" :title="$t('characters.relationship.remove', { name: rel.targetId })" @click="removeRelationship(idx)" />
      </li>
    </ul>
    <p v-else class="ae-resource-empty">
      {{ $t('characters.relationship.empty') }}
    </p>
    <form class="ae-resource-form" @submit.prevent="addRelationship">
      <AGUIProperty :for="`${fieldId}-target`" :label="$t('characters.relationship.target')">
        <AGUIInput :id="`${fieldId}-target`" v-model="newRel.targetId" />
      </AGUIProperty>
      <AGUIProperty :for="`${fieldId}-type`" :label="$t('characters.relationship.type')">
        <AGUIInput :id="`${fieldId}-type`" v-model="newRel.type" />
      </AGUIProperty>
      <AGUIProperty :for="`${fieldId}-description`" :label="$t('characters.relationship.description')">
        <AGUIInput :id="`${fieldId}-description`" v-model="newRel.description" />
      </AGUIProperty>
      <div class="ae-resource-actions">
        <AGUIButton type="submit" icon="i-ri-add-line" :disabled="!canAdd">
          {{ $t('characters.relationship.add') }}
        </AGUIButton>
      </div>
    </form>
  </AGUIDetails>
</template>
