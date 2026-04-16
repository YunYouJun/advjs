<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { IonIcon } from '@ionic/vue'
import { chatbubbleOutline, createOutline, informationCircleOutline, journalOutline, shareOutline, trashOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  character: AdvCharacter
}>()

const emit = defineEmits<{
  edit: [character: AdvCharacter]
  chat: [character: AdvCharacter]
  share: [character: AdvCharacter]
  delete: [character: AdvCharacter]
}>()

const { t } = useI18n()
const router = useRouter()

function onEdit() {
  emit('edit', props.character)
}

function onChat() {
  emit('chat', props.character)
}

function onDiary() {
  router.push(`/tabs/world/diary/${props.character.id}`)
}

function onInfo() {
  router.push(`/tabs/world/info/${props.character.id}`)
}

function onShare() {
  emit('share', props.character)
}

function onDelete() {
  emit('delete', props.character)
}
</script>

<template>
  <div class="cca">
    <button class="cca-btn" :title="t('characters.editCharacter')" @click.stop="onEdit">
      <IonIcon :icon="createOutline" class="cca-btn__icon" />
      <span class="cca-btn__label">{{ t('characters.actionEdit') }}</span>
    </button>
    <button class="cca-btn" :title="t('characters.chatWithCharacter', { name: character.name })" @click.stop="onChat">
      <IonIcon :icon="chatbubbleOutline" class="cca-btn__icon" />
      <span class="cca-btn__label">{{ t('characters.actionChat') }}</span>
    </button>
    <button class="cca-btn" :title="t('characters.viewDiary')" @click.stop="onDiary">
      <IonIcon :icon="journalOutline" class="cca-btn__icon" />
      <span class="cca-btn__label">{{ t('characters.actionDiary') }}</span>
    </button>
    <button class="cca-btn" :title="t('characters.viewDetails')" @click.stop="onInfo">
      <IonIcon :icon="informationCircleOutline" class="cca-btn__icon" />
      <span class="cca-btn__label">{{ t('characters.actionInfo') }}</span>
    </button>
    <button class="cca-btn" :title="t('characters.actionShare')" @click.stop="onShare">
      <IonIcon :icon="shareOutline" class="cca-btn__icon" />
      <span class="cca-btn__label">{{ t('characters.actionShare') }}</span>
    </button>
    <button class="cca-btn cca-btn--danger" :title="t('characters.actionDelete')" @click.stop="onDelete">
      <IonIcon :icon="trashOutline" class="cca-btn__icon" />
      <span class="cca-btn__label">{{ t('characters.actionDelete') }}</span>
    </button>
  </div>
</template>

<style scoped>
.cca {
  display: flex;
  border-top: 1px solid var(--adv-border-subtle, #e2e8f0);
}

.cca-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 2px;
  border: none;
  background: transparent;
  color: var(--adv-text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
  min-width: 0;
}

.cca-btn + .cca-btn {
  border-left: 1px solid var(--adv-border-subtle, #e2e8f0);
}

.cca-btn:hover {
  background: rgba(139, 92, 246, 0.06);
  color: #8b5cf6;
}

.cca-btn:active {
  background: rgba(139, 92, 246, 0.12);
}

.cca-btn__icon {
  font-size: 14px;
  flex-shrink: 0;
}

.cca-btn__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.cca-btn--danger:hover {
  background: rgba(239, 68, 68, 0.06);
  color: #ef4444;
}

.cca-btn--danger:active {
  background: rgba(239, 68, 68, 0.12);
}

/* Dark mode */
:root.dark .cca {
  border-top-color: rgba(255, 255, 255, 0.06);
}

:root.dark .cca-btn + .cca-btn {
  border-left-color: rgba(255, 255, 255, 0.06);
}

:root.dark .cca-btn:hover {
  background: rgba(139, 92, 246, 0.12);
  color: #a78bfa;
}

:root.dark .cca-btn--danger:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}
</style>
