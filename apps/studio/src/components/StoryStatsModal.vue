<script setup lang="ts">
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  open: boolean
  chapterTitle?: string
  totalNodes: number
  visitedOrders: number[]
  unlockedCgs: string[]
  /** AST of the current chapter — used to compute total CG count + branch totals. */
  chapterAst?: { children?: Array<{ type: string, value?: any }> }
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

const completionPct = computed(() => {
  if (props.totalNodes === 0)
    return 0
  return Math.min(100, Math.round((props.visitedOrders.length / props.totalNodes) * 100))
})

const totalCGs = computed(() => {
  const children = props.chapterAst?.children ?? []
  const set = new Set<string>()
  for (const node of children) {
    if (node.type === 'code' && Array.isArray(node.value)) {
      for (const op of node.value) {
        if (op?.type === 'background' && (op.url || op.name))
          set.add(op.url || op.name)
      }
    }
    // fountain background nodes flattened by parser
    if ((node as any).type === 'background' && ((node as any).url || (node as any).name))
      set.add((node as any).url || (node as any).name)
  }
  return set.size
})

const totalChoices = computed(() => {
  const children = props.chapterAst?.children ?? []
  return children.filter(n => n.type === 'choices').length
})

const visitedChoices = computed(() => {
  const children = props.chapterAst?.children ?? []
  let n = 0
  for (const order of props.visitedOrders) {
    if (children[order]?.type === 'choices')
      n++
  }
  return n
})

function close() {
  emit('update:open', false)
}
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="close">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('preview.statsTitle') }}</IonTitle>
        <IonButtons slot="end">
          <IonButton fill="clear" @click="close">
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <div v-if="props.chapterTitle" class="stats-header">
        {{ props.chapterTitle }}
      </div>

      <div class="stats-row">
        <div class="stats-row__label">
          {{ t('preview.statsCompletion') }}
        </div>
        <div class="stats-row__value">
          {{ completionPct }}%
        </div>
        <div class="stats-bar">
          <div class="stats-bar__fill" :style="{ width: `${completionPct}%` }" />
        </div>
        <div class="stats-row__detail">
          {{ t('preview.statsVisitedNodes') }}: {{ props.visitedOrders.length }} / {{ props.totalNodes }}
        </div>
      </div>

      <div class="stats-row">
        <div class="stats-row__label">
          {{ t('preview.statsCgCollected') }}
        </div>
        <div class="stats-row__value">
          {{ props.unlockedCgs.length }}<span v-if="totalCGs > 0"> / {{ totalCGs }}</span>
        </div>
        <div v-if="totalCGs > 0" class="stats-bar">
          <div class="stats-bar__fill stats-bar__fill--accent" :style="{ width: `${Math.min(100, Math.round((props.unlockedCgs.length / totalCGs) * 100))}%` }" />
        </div>
      </div>

      <div v-if="totalChoices > 0" class="stats-row">
        <div class="stats-row__label">
          {{ t('preview.statsBranchesExplored') }}
        </div>
        <div class="stats-row__value">
          {{ visitedChoices }} / {{ totalChoices }}
        </div>
        <div class="stats-bar">
          <div class="stats-bar__fill" :style="{ width: `${Math.min(100, Math.round((visitedChoices / totalChoices) * 100))}%` }" />
        </div>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.stats-header {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin-bottom: 16px;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}

.stats-row__label {
  font-size: var(--adv-font-body);
  color: var(--adv-text-primary);
}

.stats-row__value {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--ion-color-primary);
  font-variant-numeric: tabular-nums;
}

.stats-row__detail {
  grid-column: 1 / -1;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  margin-top: 2px;
}

.stats-bar {
  grid-column: 1 / -1;
  height: 6px;
  border-radius: 3px;
  background: rgba(var(--adv-text-secondary-rgb, 100, 100, 100), 0.12);
  overflow: hidden;
  margin-top: 4px;
}

.stats-bar__fill {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

.stats-bar__fill--accent {
  background: linear-gradient(90deg, #f59e0b, #ec4899);
}
</style>
