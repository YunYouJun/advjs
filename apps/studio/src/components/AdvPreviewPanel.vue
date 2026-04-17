<script setup lang="ts">
/**
 * Real-time preview panel for .adv.md scripts.
 * Renders parsed AST as character dialogue bubbles + scene annotations.
 */
import type { AdvAst } from '@advjs/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  content: string
}>()

const { t } = useI18n()
const ast = ref<AdvAst.Item[]>([])
const parseError = ref('')

// Dynamically import parser to avoid bundling in main chunk
const parseAst = (() => {
  let _fn: ((content: string) => Promise<AdvAst.Root>) | null = null
  return async (content: string): Promise<AdvAst.Root> => {
    if (!_fn) {
      const mod = await import('@advjs/parser')
      _fn = mod.parseAst
    }
    return _fn(content)
  }
})()

// Debounced parsing
let _parseTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.content, (newContent) => {
  clearTimeout(_parseTimer)
  _parseTimer = setTimeout(async () => {
    if (!newContent.trim()) {
      ast.value = []
      parseError.value = ''
      return
    }
    try {
      const result = await parseAst(newContent)
      ast.value = result.children
      parseError.value = ''
    }
    catch (e) {
      parseError.value = e instanceof Error ? e.message : String(e)
    }
  }, 400)
}, { immediate: true })

function getNodeType(node: AdvAst.Item): string {
  if ('type' in node) {
    return node.type
  }
  return 'unknown'
}

const items = computed(() => {
  return ast.value.map((node) => {
    const type = getNodeType(node)
    return { type, node }
  })
})
</script>

<template>
  <div class="adv-preview">
    <div class="adv-preview__header">
      <span class="adv-preview__title">Preview</span>
    </div>

    <div v-if="parseError" class="adv-preview__error">
      {{ parseError }}
    </div>

    <div v-else-if="items.length === 0" class="adv-preview__empty">
      {{ t('editor.editPlaceholder', { file: '.adv.md' }) }}
    </div>

    <div v-else class="adv-preview__content">
      <template v-for="(item, idx) in items" :key="idx">
        <!-- Scene marker -->
        <div v-if="item.type === 'scene'" class="preview-scene">
          <span class="preview-scene__icon">🎬</span>
          <span class="preview-scene__text">
            {{ (item.node as any).place }}
            <template v-if="(item.node as any).time">
              · {{ (item.node as any).time }}
            </template>
            <template v-if="(item.node as any).inOrOut">
              · {{ (item.node as any).inOrOut }}
            </template>
          </span>
        </div>

        <!-- Dialog -->
        <div v-else-if="item.type === 'dialog'" class="preview-dialog">
          <div class="preview-dialog__name">
            {{ (item.node as any).character?.name || '???' }}
          </div>
          <div class="preview-dialog__bubble">
            <template v-for="(child, ci) in ((item.node as any).children || [])" :key="ci">
              {{ typeof child === 'string' ? child : (child.value || child.text || '') }}
            </template>
          </div>
        </div>

        <!-- Narration -->
        <div v-else-if="item.type === 'narration'" class="preview-narration">
          <template v-for="(line, li) in ((item.node as any).children || [])" :key="li">
            {{ line }}
          </template>
        </div>

        <!-- Choices -->
        <div v-else-if="item.type === 'choices'" class="preview-choices">
          <div
            v-for="(choice, ci) in ((item.node as any).children || [])"
            :key="ci"
            class="preview-choice"
          >
            ▸ {{ (choice as any).text || (choice as any).value || '' }}
          </div>
        </div>

        <!-- Heading / text -->
        <div v-else-if="item.type === 'heading'" class="preview-heading">
          {{ (item.node as any).value || '' }}
        </div>

        <!-- Fallback: raw text -->
        <div v-else class="preview-text">
          {{ (item.node as any).value || (item.node as any).text || '' }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.adv-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--adv-surface-card, #fff);
  border-left: 1px solid var(--adv-border-subtle, #e2e8f0);
}

.adv-preview__header {
  padding: 8px 16px;
  border-bottom: 1px solid var(--adv-border-subtle, #e2e8f0);
  font-size: 13px;
  font-weight: 600;
  color: var(--adv-text-secondary, #64748b);
}

.adv-preview__error {
  padding: 16px;
  color: var(--ion-color-danger, #ef4444);
  font-size: 13px;
}

.adv-preview__empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: 13px;
}

.adv-preview__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Scene marker */
.preview-scene {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08));
  border-left: 3px solid var(--adv-primary, #8b5cf6);
  border-radius: 0 8px 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--adv-primary, #8b5cf6);
}

.preview-scene__icon {
  font-size: 16px;
}

/* Dialog bubble */
.preview-dialog {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-dialog__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-primary, #3880ff);
  padding-left: 4px;
}

.preview-dialog__bubble {
  background: var(--adv-surface-elevated, #f1f5f9);
  border-radius: 12px 12px 12px 4px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--adv-text-primary, #1e293b);
  max-width: 85%;
}

:root.dark .preview-dialog__bubble {
  background: var(--adv-surface-elevated, #2a2a3e);
}

/* Narration */
.preview-narration {
  font-style: italic;
  color: var(--adv-text-secondary, #64748b);
  padding: 8px 16px;
  border-left: 2px solid var(--adv-border-subtle, #e2e8f0);
  font-size: 14px;
  line-height: 1.5;
}

/* Choices */
.preview-choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-choice {
  padding: 8px 14px;
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  font-size: 14px;
  color: var(--adv-primary, #8b5cf6);
  cursor: default;
}

/* Heading */
.preview-heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--adv-text-primary, #1e293b);
  padding: 4px 0;
}

/* Fallback text */
.preview-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--adv-text-primary, #1e293b);
}
</style>
