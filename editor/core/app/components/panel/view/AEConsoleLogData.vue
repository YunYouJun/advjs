<script setup lang="ts">
import type { JsonHighlightToken } from '../../../../../../packages/shared/json-highlight'
import { computed, shallowRef, watch } from 'vue'
import { describeReportValue } from '../../../../../../apps/desktop/src/error-report'
import { highlightJson } from '../../../services/shiki'

const props = defineProps<{ data: unknown }>()
const code = computed(() => describeReportValue(props.data))
const tokens = shallowRef<JsonHighlightToken[]>()

watch(code, async (value, _previous, onCleanup) => {
  let current = true
  onCleanup(() => {
    current = false
  })
  tokens.value = undefined
  const result = await highlightJson(value)
  if (current)
    tokens.value = result
}, { immediate: true })
</script>

<template>
  <pre class="console-log-details"><template v-if="tokens"><span v-for="(token, index) in tokens" :key="index" :style="{ color: token.color }">{{ token.content }}</span></template><template v-else>{{ code }}</template></pre>
</template>

<style scoped>
.console-log-details {
  margin: 4px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--agui-c-text-2);
  font-size: 12px;
}
</style>
