<script setup lang="ts">
import type { ChatMessage } from '../stores/useChatStore'
import { IonButton, IonIcon } from '@ionic/vue'
import { copyOutline, createOutline, refreshOutline, thumbsDown, thumbsDownOutline, thumbsUp, thumbsUpOutline, trashOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  message: ChatMessage
  isLast?: boolean
  isLoading?: boolean
  /** Hide the edit button (e.g. in group chat where editing single messages is not supported) */
  showEdit?: boolean
  /** Current feedback state of this message */
  feedback?: 'up' | 'down'
}>()

const emit = defineEmits<{
  copy: []
  edit: []
  delete: []
  regenerate: []
  feedbackUp: []
  feedbackDown: []
}>()

const { t } = useI18n()

// Mobile touch support: show actions for a brief period after touch
const mobileVisible = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function onTouchStart() {
  if (hideTimer)
    clearTimeout(hideTimer)
  mobileVisible.value = true
  hideTimer = setTimeout(() => {
    mobileVisible.value = false
  }, 2000)
}
</script>

<template>
  <div
    class="msg-actions"
    :class="{ 'msg-actions--visible': mobileVisible }"
    @touchstart.passive="onTouchStart"
  >
    <!-- Copy -->
    <IonButton
      fill="clear"
      size="small"
      :disabled="props.isLoading"
      :aria-label="t('chat.copyMessage')"
      class="msg-action-btn"
      @click.stop="emit('copy')"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonIcon slot="icon-only" :icon="copyOutline" />
    </IonButton>

    <!-- Edit (user messages only, hidden when showEdit is false) -->
    <IonButton
      v-if="props.message.role === 'user' && props.showEdit !== false"
      fill="clear"
      size="small"
      :disabled="props.isLoading"
      :aria-label="t('chat.editMessage')"
      class="msg-action-btn"
      @click.stop="emit('edit')"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonIcon slot="icon-only" :icon="createOutline" />
    </IonButton>

    <!-- Regenerate (last assistant message only) -->
    <IonButton
      v-if="props.message.role === 'assistant' && props.isLast"
      fill="clear"
      size="small"
      :disabled="props.isLoading"
      :aria-label="t('chat.regenerate')"
      class="msg-action-btn"
      @click.stop="emit('regenerate')"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonIcon slot="icon-only" :icon="refreshOutline" />
    </IonButton>

    <!-- Feedback (assistant messages only) -->
    <IonButton
      v-if="props.message.role === 'assistant'"
      fill="clear"
      size="small"
      :disabled="props.isLoading"
      :aria-label="t('chat.goodResponse')"
      class="msg-action-btn"
      :class="{ 'msg-action-btn--active': props.feedback === 'up' }"
      @click.stop="emit('feedbackUp')"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonIcon slot="icon-only" :icon="props.feedback === 'up' ? thumbsUp : thumbsUpOutline" />
    </IonButton>
    <IonButton
      v-if="props.message.role === 'assistant'"
      fill="clear"
      size="small"
      :disabled="props.isLoading"
      :aria-label="t('chat.badResponse')"
      class="msg-action-btn"
      :class="{ 'msg-action-btn--active': props.feedback === 'down' }"
      @click.stop="emit('feedbackDown')"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonIcon slot="icon-only" :icon="props.feedback === 'down' ? thumbsDown : thumbsDownOutline" />
    </IonButton>

    <!-- Delete -->
    <IonButton
      fill="clear"
      size="small"
      color="danger"
      :disabled="props.isLoading"
      :aria-label="t('chat.deleteMessage')"
      class="msg-action-btn"
      @click.stop="emit('delete')"
    >
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonIcon slot="icon-only" :icon="trashOutline" />
    </IonButton>
  </div>
</template>

<style scoped>
.msg-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--adv-duration-fast, 150ms) ease;
  pointer-events: none;
}

/* Show on desktop hover (parent .message:hover triggers via CSS) */
.message:hover .msg-actions,
.msg-actions:focus-within {
  opacity: 1;
  pointer-events: auto;
}

/* Mobile: show on touch */
.msg-actions--visible {
  opacity: 1;
  pointer-events: auto;
}

.msg-action-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  --padding-top: 4px;
  --padding-bottom: 4px;
  width: 28px;
  height: 28px;
  font-size: 14px;
}

.msg-action-btn ion-icon {
  font-size: 14px;
}

.msg-action-btn--active {
  color: var(--ion-color-primary);
}
</style>
