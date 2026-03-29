<script setup lang="ts">
import type { AdvCharacter, AdvCharacterDynamicState } from '@advjs/types'
import type { KnowledgeEntry } from '../composables/useKnowledgeBase'
import { IonButton, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KnowledgeManageModal from './KnowledgeManageModal.vue'

defineProps<{
  character: AdvCharacter
  isOpen: boolean
  dynamicState?: AdvCharacterDynamicState
  knowledgeEntries?: KnowledgeEntry[]
  knowledgeLoading?: boolean
}>()

const emit = defineEmits<{
  close: []
  refreshKnowledge: []
}>()

const { t } = useI18n()

const showKnowledgeModal = ref(false)
</script>

<template>
  <IonModal :is-open="isOpen" :initial-breakpoint="0.75" :breakpoints="[0, 0.5, 0.75, 1]" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ character.name }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <div class="ci-sections">
        <section v-if="character.appearance" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.appearance') }}
          </h4>
          <p class="ci-section__content">
            {{ character.appearance }}
          </p>
        </section>

        <section v-if="character.personality" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.personality') }}
          </h4>
          <p class="ci-section__content">
            {{ character.personality }}
          </p>
        </section>

        <section v-if="character.background" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.background') }}
          </h4>
          <p class="ci-section__content">
            {{ character.background }}
          </p>
        </section>

        <section v-if="character.concept" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.concept') }}
          </h4>
          <p class="ci-section__content">
            {{ character.concept }}
          </p>
        </section>

        <section v-if="character.speechStyle" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.speechStyle') }}
          </h4>
          <p class="ci-section__content">
            {{ character.speechStyle }}
          </p>
        </section>

        <section v-if="character.knowledgeDomain" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.knowledgeDomain') }}
          </h4>
          <p class="ci-section__content">
            {{ character.knowledgeDomain }}
          </p>
          <IonButton
            v-if="knowledgeEntries"
            fill="outline"
            size="small"
            class="ci-knowledge-btn"
            @click="showKnowledgeModal = true"
          >
            {{ t('world.knowledgeBase') }}
          </IonButton>
        </section>

        <section v-if="character.faction" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.faction') }}
          </h4>
          <p class="ci-section__content">
            {{ character.faction }}
          </p>
        </section>

        <section v-if="dynamicState && (dynamicState.location || dynamicState.health || dynamicState.activity || dynamicState.attributes)" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.currentState') }}
          </h4>
          <div class="ci-state">
            <div v-if="dynamicState.location" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.location') }}</span>
              <span class="ci-state__value">📍 {{ dynamicState.location }}</span>
            </div>
            <div v-if="dynamicState.health" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.health') }}</span>
              <span class="ci-state__value">{{ dynamicState.health }}</span>
            </div>
            <div v-if="dynamicState.activity" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.activity') }}</span>
              <span class="ci-state__value">{{ dynamicState.activity }}</span>
            </div>
            <div v-if="dynamicState.attributes && Object.keys(dynamicState.attributes).length > 0" class="ci-state__attrs">
              <span class="ci-state__label">{{ t('world.attributes') }}</span>
              <div v-for="(value, key) in dynamicState.attributes" :key="key" class="ci-state__attr">
                <span class="ci-state__attr-key">{{ key }}</span>
                <span class="ci-state__attr-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="character.relationships?.length" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.relationships') }}
          </h4>
          <div v-for="rel in character.relationships" :key="rel.targetId" class="ci-rel">
            <span class="ci-rel__target">{{ rel.targetId }}</span>
            <span class="ci-rel__type">{{ rel.type }}</span>
            <span v-if="rel.description" class="ci-rel__desc">{{ rel.description }}</span>
          </div>
        </section>

        <section v-if="character.tags?.length" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.tags') }}
          </h4>
          <p class="ci-section__content">
            {{ character.tags.join(', ') }}
          </p>
        </section>
      </div>
    </IonContent>

    <!-- Knowledge Base Modal -->
    <KnowledgeManageModal
      v-if="character.knowledgeDomain && knowledgeEntries"
      :is-open="showKnowledgeModal"
      :domain="character.knowledgeDomain"
      :entries="knowledgeEntries"
      :is-loading="knowledgeLoading || false"
      @close="showKnowledgeModal = false"
      @refresh="emit('refreshKnowledge')"
    />
  </IonModal>
</template>

<style scoped>
.ci-sections {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-lg);
}

.ci-section__title {
  font-size: var(--adv-font-body-sm);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-xs);
}

.ci-section__content {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.ci-rel {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-xs) 0;
}

.ci-rel__target {
  font-weight: 600;
  color: var(--adv-text-primary);
}

.ci-rel__type {
  font-size: var(--adv-font-caption);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 2px 8px;
  border-radius: var(--adv-radius-sm);
}

.ci-rel__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.ci-state {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.ci-state__item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
}

.ci-state__label {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  min-width: 48px;
}

.ci-state__value {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-primary);
}

.ci-state__attrs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--adv-space-xs);
}

.ci-state__attr {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding-left: var(--adv-space-sm);
}

.ci-state__attr-key {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}

.ci-state__attr-value {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: #8b5cf6;
}

.ci-knowledge-btn {
  margin-top: var(--adv-space-xs);
  --color: #8b5cf6;
  --border-color: rgba(139, 92, 246, 0.3);
}
</style>
