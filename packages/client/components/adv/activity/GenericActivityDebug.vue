<script setup lang="ts">
import type { JsonValue } from '@advjs/types'
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '../../../types'
import { shallowRef, watch } from 'vue'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()

const jsonResult = shallowRef('{}')
const error = shallowRef('')

watch(() => props.activity.id, () => {
  jsonResult.value = '{}'
  error.value = ''
})

function submit() {
  error.value = ''
  try {
    emit('complete', JSON.parse(jsonResult.value) as JsonValue)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <div class="activity-debug">
    <h2 class="activity-debug__title">
      Runtime Activity
    </h2>
    <pre class="activity-debug__input">{{ props.activity.input }}</pre>
    <textarea v-model="jsonResult" class="activity-debug__result" rows="5" aria-label="JSON result" />
    <div class="activity-debug__actions">
      <button type="button" @click="emit('back')">
        返回
      </button>
      <button type="button" @click="submit">
        提交 JSON
      </button>
    </div>
    <p v-if="error" class="activity-debug__error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.activity-debug {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-debug__title {
  margin: 0;
}

.activity-debug__input {
  margin: 0;
  white-space: pre-wrap;
}

.activity-debug__result {
  min-height: 7rem;
  padding: 0.5rem;
  border: 1px solid rgb(148 163 184 / 40%);
  border-radius: 0.4rem;
  background: rgb(2 6 23 / 70%);
  color: inherit;
}

.activity-debug__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.activity-debug__error {
  margin: 0;
  color: #fca5a5;
}
</style>
