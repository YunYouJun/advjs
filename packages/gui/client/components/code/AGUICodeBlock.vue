<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue'
import AGUIButton from '../button/AGUIButton.vue'

const props = withDefaults(defineProps<{
  code: string
  label?: string
  copyLabel?: string
  copiedLabel?: string
  copyErrorLabel?: string
  copy?: (text: string) => Promise<void>
}>(), {
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  copyErrorLabel: 'Copy failed. The code is selected; copy it manually with your keyboard or context menu.',
})
const id = useId()
const codeElement = useTemplateRef<HTMLPreElement>('code')
const copying = shallowRef(false)
const copied = shallowRef(false)
const failed = shallowRef(false)
let generation = 0
let disposed = false
let timer: ReturnType<typeof setTimeout> | undefined

function reset() {
  generation++
  clearTimeout(timer)
  timer = undefined
  copying.value = copied.value = failed.value = false
}
function selectCode() {
  const element = codeElement.value
  const selection = window.getSelection()
  if (!element || !selection)
    return
  element.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
}
function selectShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    selectCode()
  }
}
async function copyCode() {
  if (copying.value || disposed)
    return
  reset()
  const current = generation
  const code = props.code
  const active = () => !disposed && current === generation && props.code === code
  copying.value = true
  try {
    if (props.copy) {
      await props.copy(code)
    }
    else {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
    }
    if (active()) {
      copied.value = true
      timer = setTimeout(() => {
        copied.value = false
        timer = undefined
      }, 2000)
    }
  }
  catch {
    if (active()) {
      failed.value = true
      await nextTick()
      if (active())
        selectCode()
    }
  }
  finally {
    if (active())
      copying.value = false
  }
}
watch([() => props.code, () => props.copy], reset, { flush: 'sync' })
onBeforeUnmount(() => {
  disposed = true
  generation++
  clearTimeout(timer)
})
</script>

<template>
  <figure class="agui-code-block" :aria-label="label">
    <figcaption class="agui-code-block__header">
      <span v-if="label" class="agui-code-block__label">{{ label }}</span>
      <AGUIButton class="agui-code-block__copy" :loading="copying" :aria-label="copied ? copiedLabel : copyLabel" :aria-describedby="failed ? `${id}-status` : undefined" @click="copyCode">
        {{ copied ? copiedLabel : copyLabel }}
      </AGUIButton>
    </figcaption>
    <pre ref="code" class="agui-code-block__code" :aria-label="label" :aria-describedby="failed ? `${id}-status` : undefined" tabindex="0" @keydown="selectShortcut"><code>{{ code }}</code></pre>
    <p :id="`${id}-status`" class="agui-code-block__status" :class="{ 'agui-code-block__status--error': failed }" role="status" aria-live="polite">
      {{ failed ? copyErrorLabel : copied ? copiedLabel : '' }}
    </p>
  </figure>
</template>

<style lang="scss" scoped>
.agui-code-block {
  min-width: 0;
  margin: 0;
  border: 1px solid var(--agui-c-divider-light);
  border-radius: var(--agui-radius-sm);
  background: var(--agui-c-field);
  color: var(--agui-c-text-1);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
}
.agui-code-block__header {
  font-family: var(--agui-font-family-ui);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--agui-space-2);
  padding: var(--agui-space-1) var(--agui-space-2);
  border-bottom: 1px solid var(--agui-c-divider-light);
}
.agui-code-block__label {
  flex: 1;
  min-width: 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  overflow-wrap: anywhere;
}
.agui-code-block__copy {
  --border-radius: var(--agui-radius-sm);
  max-width: 100%;
  margin-left: auto;
  white-space: normal;
  overflow-wrap: anywhere;
}
.agui-code-block__code {
  min-width: 0;
  margin: 0;
  padding: var(--agui-space-2);
  color: var(--agui-c-text-code);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: inherit;
  line-height: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
}
.agui-code-block__code code {
  font: inherit;
  color: inherit;
}
.agui-code-block__status {
  font-family: var(--agui-font-family-ui);
  margin: 0;
  padding: 0 var(--agui-space-2) var(--agui-space-2);
  color: var(--agui-c-success-text);
  font-size: var(--agui-font-size-caption);
  overflow-wrap: anywhere;
  &:empty {
    display: none;
  }
}
.agui-code-block__status--error {
  color: var(--agui-c-warning-text);
}
</style>
