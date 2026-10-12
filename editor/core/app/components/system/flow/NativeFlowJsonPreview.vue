<script setup lang="ts">
import type { JsonHighlightToken } from '../../../../../../packages/shared/json-highlight'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { MAX_JSON_HIGHLIGHT_LENGTH } from '../../../../../../packages/shared/json-highlight'
import { highlightJson } from '../../../services/shiki'

const props = defineProps<{ code: string, title: string }>()
const tokens = shallowRef<JsonHighlightToken[]>()
const copying = ref(false)
const copyStatus = ref('')
const copyError = ref(false)
const large = computed(() => props.code.length > MAX_JSON_HIGHLIGHT_LENGTH)
let copyAttempt = 0

watch(() => props.code, async (code, _previous, onCleanup) => {
  let current = true
  onCleanup(() => {
    current = false
  })
  copyAttempt++
  copying.value = false
  copyStatus.value = ''
  copyError.value = false
  tokens.value = undefined
  if (code.length > MAX_JSON_HIGHLIGHT_LENGTH)
    return
  try {
    const result = await highlightJson(code)
    // The preview and clipboard must always preserve the original source bytes.
    if (current && result?.map(token => token.content).join('') === code)
      tokens.value = result
  }
  catch {
    // Source remains readable and copyable if the optional highlighter fails.
  }
}, { immediate: true })

onBeforeUnmount(() => {
  copyAttempt++
})

async function copyCode() {
  if (copying.value)
    return
  const attempt = ++copyAttempt
  const code = props.code
  const title = props.title
  copying.value = true
  copyStatus.value = ''
  copyError.value = false
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(code)
    if (attempt === copyAttempt)
      copyStatus.value = `已复制${title} JSON`
  }
  catch {
    if (attempt === copyAttempt) {
      copyError.value = true
      copyStatus.value = '复制失败，请选中下方 JSON 手动复制'
    }
  }
  finally {
    if (attempt === copyAttempt)
      copying.value = false
  }
}
</script>

<template>
  <section class="native-json-preview" :aria-label="`${title} JSON 只读预览`">
    <div class="json-preview-toolbar">
      <h4>{{ title }}</h4>
      <span class="json-preview-label">JSON · 只读</span>
      <AGUIButton :disabled="copying" :aria-label="`复制${title} JSON`" @click="copyCode">
        {{ copying ? '复制中…' : '复制 JSON' }}
      </AGUIButton>
    </div>
    <p v-if="large" class="json-preview-note">
      内容较大，已显示完整纯文本；仍可复制
    </p>
    <p class="json-preview-status" :class="{ 'json-preview-error': copyError }" role="status" aria-live="polite" aria-atomic="true">
      {{ copyStatus }}
    </p>
    <pre tabindex="0" role="region" :aria-label="`${title} JSON 只读源码`"><code><template v-if="tokens"><span v-for="(token, index) in tokens" :key="index" :style="{ color: token.color }">{{ token.content }}</span></template><template v-else>{{ code }}</template></code></pre>
  </section>
</template>

<style scoped>
.native-json-preview {
  min-width: 0;
}
.json-preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.json-preview-toolbar h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.json-preview-label,
.json-preview-note,
.json-preview-status {
  color: var(--agui-c-text-2);
  font-size: 12px;
}
.json-preview-note,
.json-preview-status {
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.json-preview-status:empty {
  margin: 0;
}
.json-preview-error {
  color: var(--agui-c-danger-text);
}
.native-json-preview pre {
  max-height: 240px;
  max-width: 100%;
  margin: 4px 0;
  padding: 8px;
  overflow: auto;
  white-space: pre;
  color: var(--agui-c-text-1);
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-border);
  border-radius: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  tab-size: 2;
}
.native-json-preview pre:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: -2px;
}
.native-json-preview code {
  font: inherit;
}
</style>
