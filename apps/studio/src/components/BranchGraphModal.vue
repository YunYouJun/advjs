<script setup lang="ts">
import type { AdvAst } from '@advjs/types'
import { analyzeBranches, formatMermaid } from '@advjs/core'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  open: boolean
  /** Current chapter's parsed fountain AST (BranchGraph source). */
  ast?: AdvAst.Root
  /** Index of the currently active node — highlighted in the graph. */
  currentOrder?: number
  /** Indexes the player has already visited — drawn in muted colour. */
  visitedOrders?: number[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const svgHtml = ref('')
const loading = ref(false)
const error = ref('')

function close() {
  emit('update:open', false)
}

/**
 * Append highlight class bindings to the mermaid source so the current node
 * and visited paths are visually distinct from the rest of the graph.
 *
 * Mermaid syntax: `class node1,node2 className`.
 */
function injectHighlights(mermaidSrc: string, ast: AdvAst.Root, currentOrder: number, visited: number[]): string {
  // Map AST indexes → scene/choices node IDs (parallels analyzeBranches's naming).
  const sceneIds = new Set<string>()
  const visitedIds: string[] = []
  let currentId: string | null = null

  for (const v of visited) {
    if (ast.children[v]?.type === 'scene')
      visitedIds.push(`scene_${v}`)
    else if (ast.children[v]?.type === 'choices')
      visitedIds.push(`choices_${v}`)
  }
  if (ast.children[currentOrder]?.type === 'scene')
    currentId = `scene_${currentOrder}`
  else if (ast.children[currentOrder]?.type === 'choices')
    currentId = `choices_${currentOrder}`
  // Lookup-only: avoid unused warning.
  void sceneIds

  const lines = [mermaidSrc]
  if (visitedIds.length > 0)
    lines.push(`  class ${visitedIds.join(',')} visited`)
  if (currentId)
    lines.push(`  class ${currentId} current`)
  lines.push('  classDef visited fill:#dbeafe,stroke:#3b82f6,color:#1e3a8a;')
  lines.push('  classDef current fill:#fef3c7,stroke:#d97706,color:#92400e,stroke-width:3px;')
  return lines.join('\n')
}

async function render() {
  if (!props.ast) {
    svgHtml.value = ''
    return
  }
  loading.value = true
  error.value = ''
  try {
    const graph = analyzeBranches(props.ast)
    let mermaidSrc = formatMermaid(graph)
    mermaidSrc = injectHighlights(mermaidSrc, props.ast, props.currentOrder ?? -1, props.visitedOrders ?? [])
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    const { svg } = await mermaid.render(`adv-branch-${Date.now()}`, mermaidSrc)
    svgHtml.value = svg
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    svgHtml.value = ''
  }
  finally {
    loading.value = false
  }
}

watch(() => props.open, (open) => {
  if (open)
    render()
})
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="close">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('preview.branchGraphTitle') }}</IonTitle>
        <IonButtons slot="end">
          <IonButton fill="clear" @click="close">
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <div v-if="loading" class="branch-status">
        {{ t('preview.branchGraphLoading') }}
      </div>
      <div v-else-if="error" class="branch-error">
        {{ t('preview.branchGraphError') }}: {{ error }}
      </div>
      <div v-else-if="svgHtml" class="branch-legend">
        {{ t('preview.branchGraphLegend') }}
      </div>
      <div class="branch-canvas" v-html="svgHtml" />
    </IonContent>
  </IonModal>
</template>

<style scoped>
.branch-status,
.branch-error {
  padding: 24px;
  text-align: center;
  color: var(--adv-text-secondary);
}

.branch-error {
  color: #f44336;
  font-size: var(--adv-font-body-sm);
}

.branch-legend {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  margin-bottom: 12px;
}

.branch-canvas {
  width: 100%;
  overflow: auto;
}

.branch-canvas :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
