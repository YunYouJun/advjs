<script setup lang="ts">
import type { Child } from '@advjs/types'
import { parseAst } from '@advjs/parser'
import { IonChip, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/vue'
import { personOutline } from 'ionicons/icons'
import { onMounted, ref } from 'vue'

const props = defineProps<{
  content: string
}>()

const nodes = ref<Child[]>([])
const parseError = ref('')

onMounted(async () => {
  try {
    const ast = await parseAst(props.content)
    nodes.value = ast.children
  }
  catch (e) {
    parseError.value = String(e)
  }
})

function getDialogText(node: Child): string {
  if (node.type === 'dialog' && 'children' in node) {
    return (node.children as Array<{ type: string, value?: string }>)
      .filter(c => c.type === 'text')
      .map(c => c.value || '')
      .join('')
  }
  return ''
}

function getNarrationText(node: Child): string {
  if (node.type === 'narration' && 'children' in node)
    return (node.children as string[]).join('\n')
  return ''
}
</script>

<template>
  <div class="chapter-reader">
    <div v-if="parseError" class="chapter-reader__error">
      Parse error: {{ parseError }}
    </div>

    <template v-for="(node, index) in nodes" :key="index">
      <!-- Narration (blockquote) -->
      <IonNote
        v-if="node.type === 'narration'"
        class="chapter-reader__narration"
      >
        {{ getNarrationText(node) }}
      </IonNote>

      <!-- Dialog -->
      <IonItem v-else-if="node.type === 'dialog' && 'character' in node" lines="none">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonChip slot="start" color="primary" class="chapter-reader__character-chip">
          <IonIcon :icon="personOutline" />
          <IonLabel>{{ (node as any).character.name }}</IonLabel>
        </IonChip>
        <IonLabel class="ion-text-wrap">
          {{ getDialogText(node) }}
        </IonLabel>
      </IonItem>

      <!-- Paragraph with possible nested dialogs -->
      <template v-else-if="node.type === 'paragraph' && 'children' in node">
        <template v-for="(child, ci) in (node as any).children" :key="`p-${index}-${ci}`">
          <IonItem v-if="child.type === 'dialog'" lines="none">
            <template #start>
              <IonChip color="primary" class="chapter-reader__character-chip">
                <IonIcon :icon="personOutline" />
                <IonLabel>{{ child.character.name }}</IonLabel>
              </IonChip>
            </template>
            <IonLabel class="ion-text-wrap">
              {{ child.children?.filter((c: any) => c.type === 'text').map((c: any) => c.value).join('') }}
            </IonLabel>
          </IonItem>
          <IonNote
            v-else-if="child.type === 'text'"
            class="chapter-reader__text-note"
          >
            {{ child.value }}
          </IonNote>
        </template>
      </template>

      <!-- Scene info -->
      <IonChip
        v-else-if="node.type === 'scene'"
        color="tertiary"
        class="chapter-reader__scene-chip"
      >
        {{ (node as any).place }} · {{ (node as any).time }} · {{ (node as any).inOrOut }}
      </IonChip>

      <!-- Choices -->
      <div v-else-if="node.type === 'choices'" class="chapter-reader__choices">
        <IonChip
          v-for="(choice, ci) in (node as any).choices"
          :key="ci"
          color="warning"
          class="chapter-reader__choice-chip"
        >
          {{ choice.text }}
        </IonChip>
      </div>

      <!-- Code blocks -->
      <IonNote
        v-else-if="node.type === 'code'"
        class="chapter-reader__code"
      >
        [code block]
      </IonNote>
    </template>

    <div v-if="nodes.length === 0 && !parseError" class="chapter-reader__empty">
      No content to display
    </div>
  </div>
</template>

<style scoped>
.chapter-reader {
  padding: var(--adv-space-sm) 0;
}

.chapter-reader__error {
  padding: var(--adv-space-md);
  color: var(--ion-color-danger);
}

.chapter-reader__narration {
  display: block;
  padding: var(--adv-space-sm) var(--adv-space-md);
  font-style: italic;
  color: var(--adv-text-secondary);
}

.chapter-reader__character-chip {
  min-width: fit-content;
}

.chapter-reader__text-note {
  display: block;
  padding: var(--adv-space-xs) var(--adv-space-md);
}

.chapter-reader__scene-chip {
  margin: var(--adv-space-sm) var(--adv-space-md);
}

.chapter-reader__choices {
  padding: var(--adv-space-sm) var(--adv-space-md);
}

.chapter-reader__choice-chip {
  margin: var(--adv-space-xs);
}

.chapter-reader__code {
  display: block;
  padding: var(--adv-space-sm) var(--adv-space-md);
  font-family: monospace;
  font-size: 12px;
  color: var(--adv-text-tertiary);
}

.chapter-reader__empty {
  padding: var(--adv-space-lg);
  text-align: center;
  color: var(--adv-text-tertiary);
}
</style>
