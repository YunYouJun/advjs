<script setup lang="ts">
import { IonButton, IonIcon, IonTextarea, IonToolbar } from '@ionic/vue'
import { sendOutline, stopOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send': []
  'stop': []
  'focus': []
}>()

const { t } = useI18n()

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send')
  }
}
</script>

<template>
  <IonToolbar>
    <div class="chat-input-bar">
      <slot name="prepend" />
      <IonTextarea
        :value="modelValue"
        :placeholder="placeholder || t('world.chatPlaceholder')"
        :disabled="disabled"
        :auto-grow="true"
        :rows="1"
        class="chat-input"
        @ion-input="emit('update:modelValue', ($event.detail.value ?? ''))"
        @keydown="handleKeydown"
        @ion-focus="emit('focus')"
      />
      <IonButton
        v-if="isLoading"
        shape="round"
        fill="solid"
        color="danger"
        class="chat-send-btn"
        :aria-label="t('world.stopGeneration')"
        @click="emit('stop')"
      >
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="stopOutline" />
      </IonButton>
      <IonButton
        v-else
        shape="round"
        fill="solid"
        class="chat-send-btn"
        :disabled="!modelValue.trim() || disabled"
        :aria-label="t('world.send')"
        @click="emit('send')"
      >
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="sendOutline" />
      </IonButton>
    </div>
  </IonToolbar>
</template>

<style scoped>
.chat-input-bar {
  display: flex;
  align-items: center;
  padding: var(--adv-space-sm) var(--adv-space-md);
  gap: var(--adv-space-sm);
}

.chat-input {
  flex: 1;
  --background: var(--adv-surface-elevated);
  --border-radius: var(--adv-radius-xl);
  --padding-start: var(--adv-space-md);
  --padding-end: var(--adv-space-md);
  --min-height: 44px;
  height: 44px;
}

.chat-send-btn {
  --padding-start: 10px;
  --padding-end: 10px;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}
</style>
