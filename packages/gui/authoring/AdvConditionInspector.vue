<script setup lang="ts">
import type { AuthoringConditionAdapter } from './types'
import { computed, shallowRef, useId, watch } from 'vue'
import { inspectConditionText } from './condition'

const props = withDefaults(defineProps<{
  label: string
  value: unknown
  adapter: AuthoringConditionAdapter
  draft?: string
  optional?: boolean
  disabled?: boolean
  rows?: number
  hint?: string
  labels?: { invalid?: string, references?: string }
}>(), { rows: 5 })
const emit = defineEmits<{ change: [value: unknown], invalid: [text?: string] }>()
const id = useId()
const render = () => props.draft ?? props.adapter.format(props.value)
const text = shallowRef(render())
watch(() => [props.value, props.draft], () => {
  if (props.draft !== undefined) {
    text.value = props.draft
  }
  else {
    try {
      const current = inspectConditionText(props.adapter, text.value, props.optional)
      if (!current.parsed || props.adapter.format(current.value) !== props.adapter.format(props.value))
        text.value = render()
    }
    catch { text.value = render() }
  }
})
const inspection = computed(() => inspectConditionText(props.adapter, text.value, props.optional))
const invalid = computed(() => props.draft !== undefined || inspection.value.diagnostics.some(issue => issue.severity === 'error'))
const semanticIssues = computed(() => inspection.value.parsed ? inspection.value.diagnostics : [])
function input(event: Event) {
  if (props.disabled)
    return
  text.value = (event.target as HTMLTextAreaElement).value
  const result = inspection.value
  if (!result.parsed) {
    emit('invalid', text.value)
  }
  else {
    emit('invalid')
    emit('change', result.value)
  }
}
</script>

<template>
  <div class="field json-field" data-adv-authoring="condition">
    <label :for="id">{{ label }}</label>
    <textarea :id="id" :value="text" :rows="rows" :disabled="disabled" :aria-invalid="invalid" :aria-describedby="`${id}-hint ${id}-issues`" spellcheck="false" @input="input" />
    <small :id="`${id}-hint`" :class="{ error: invalid }">{{ invalid ? labels?.invalid ?? 'The draft contains errors. Fix them before saving.' : hint }}</small>
    <ul :id="`${id}-issues`" class="condition-issues">
      <li v-for="(issue, index) in semanticIssues" :key="`${issue.code}:${index}`" :data-severity="issue.severity">
        {{ issue.message }}
      </li>
    </ul>
    <details v-if="adapter.references?.length || adapter.examples?.length" class="condition-reference">
      <summary>{{ labels?.references ?? 'References and examples' }}</summary><code v-for="example in adapter.examples" :key="example">{{ example }}</code><dl>
        <template v-for="reference in adapter.references" :key="reference.name">
          <dt><code>{{ reference.name }}</code></dt><dd v-if="reference.description">
            {{ reference.description }}
          </dd>
        </template>
      </dl>
    </details>
  </div>
</template>

<style scoped>
.json-field {
  min-width: 0;
}
.json-field textarea {
  box-sizing: border-box;
  width: 100%;
  font-family: monospace;
  tab-size: 2;
}
.condition-issues {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-wrap: anywhere;
}
.condition-reference {
  overflow-wrap: anywhere;
}
.condition-reference > code {
  display: block;
  white-space: pre-wrap;
}
.condition-reference dl {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.condition-reference dd {
  margin: 0;
}
</style>
