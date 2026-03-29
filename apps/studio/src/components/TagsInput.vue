<script setup lang="ts">
import {
  IonChip,
  IonIcon,
  IonInput,
  IonLabel,
} from '@ionic/vue'
import { closeCircle } from 'ionicons/icons'
import { ref } from 'vue'

defineProps<{
  placeholder?: string
}>()

const model = defineModel<string[]>({ default: () => [] })

const inputValue = ref('')

function addTag() {
  const tag = inputValue.value.trim()
  if (tag && !model.value.includes(tag)) {
    model.value = [...model.value, tag]
  }
  inputValue.value = ''
}

function removeTag(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
}
</script>

<template>
  <div class="tags-input">
    <div v-if="model.length > 0" class="tags-input__chips">
      <IonChip
        v-for="(tag, index) in model"
        :key="tag"
        class="tags-input__chip"
        @click="removeTag(index)"
      >
        <IonLabel>{{ tag }}</IonLabel>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="end" :icon="closeCircle" />
      </IonChip>
    </div>
    <IonInput
      v-model="inputValue"
      :placeholder="placeholder || 'Add tag...'"
      class="tags-input__input"
      @keydown="handleKeydown"
      @ion-blur="addTag"
    />
  </div>
</template>

<style scoped>
.tags-input {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.tags-input__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tags-input__chip {
  height: 28px;
  font-size: var(--adv-font-caption);
  margin: 0;
}

.tags-input__input {
  --padding-start: 0;
  font-size: var(--adv-font-body-sm);
}
</style>
