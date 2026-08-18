<script setup lang="ts">
import { IonIcon, IonModal } from '@ionic/vue'
import { closeOutline, sparklesOutline } from 'ionicons/icons'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useManagedAgentSession } from '../../composables/useManagedAgentSession'
import { useResponsive } from '../../composables/useResponsive'
import { useAuthStore } from '../../stores/useAuthStore'
import { useManagedAgentStore } from '../../stores/useManagedAgentStore'
import ManagedAgentConsole from './ManagedAgentConsole.vue'

const { t } = useI18n()
const { isWide } = useResponsive()
const authStore = useAuthStore()
const managedStore = useManagedAgentStore()
const { isLoggedIn } = storeToRefs(authStore)
const { status, hasActiveTask, error } = storeToRefs(managedStore)
const sheetOpen = ref(false)

const compactLabel = computed(() => {
  if (error.value)
    return t('managedAi.attention')
  if (status.value)
    return t(`managedAi.status.${status.value}`)
  return t('managedAi.shortTitle')
})

useManagedAgentSession()
</script>

<template>
  <aside v-if="isWide" class="managed-agent-rail" :aria-label="$t('managedAi.title')">
    <ManagedAgentConsole :logged-in="isLoggedIn" />
  </aside>

  <template v-else>
    <button
      type="button"
      class="managed-agent-dock"
      :class="{
        'managed-agent-dock--active': hasActiveTask,
        'managed-agent-dock--error': error,
      }"
      :aria-label="$t('managedAi.openPanel', { status: compactLabel })"
      @click="sheetOpen = true"
    >
      <IonIcon :icon="sparklesOutline" aria-hidden="true" />
      <span>{{ compactLabel }}</span>
      <i aria-hidden="true" />
    </button>

    <IonModal
      :is-open="sheetOpen"
      :initial-breakpoint="0.82"
      :breakpoints="[0, 0.55, 0.82, 1]"
      handle-behavior="cycle"
      css-class="managed-agent-sheet"
      @did-dismiss="sheetOpen = false"
    >
      <div class="managed-agent-sheet__content">
        <button
          type="button"
          class="managed-agent-sheet__close"
          :aria-label="$t('managedAi.close')"
          @click="sheetOpen = false"
        >
          <IonIcon :icon="closeOutline" aria-hidden="true" />
        </button>
        <ManagedAgentConsole :logged-in="isLoggedIn" />
      </div>
    </IonModal>
  </template>
</template>

<style scoped>
.managed-agent-rail {
  width: 304px;
  min-width: 304px;
  height: 100%;
  overflow: auto;
  border-left: 1px solid rgba(23, 19, 31, 0.85);
  background: #17131f;
}

.managed-agent-dock {
  position: fixed;
  right: 14px;
  bottom: calc(66px + env(safe-area-inset-bottom));
  z-index: var(--adv-z-sticky);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: calc(100vw - 28px);
  height: 44px;
  padding: 0 12px;
  color: #f7f5fb;
  border: 1px solid rgba(212, 168, 83, 0.52);
  border-radius: 4px;
  background: #17131f;
  box-shadow: 0 5px 18px rgba(23, 19, 31, 0.24);
  font-family: var(--adv-font-mono);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.managed-agent-dock span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.managed-agent-dock i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(247, 245, 251, 0.38);
}

.managed-agent-dock--active i {
  background: #54d6b2;
}

.managed-agent-dock--error i {
  background: #df5b63;
}

.managed-agent-dock:focus-visible,
.managed-agent-sheet__close:focus-visible {
  outline: 3px solid #d4a853;
  outline-offset: 3px;
}

.managed-agent-sheet__content {
  position: relative;
  min-height: 100%;
  background: #17131f;
}

.managed-agent-sheet__close {
  position: absolute;
  top: 12px;
  right: 10px;
  z-index: 2;
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  color: rgba(247, 245, 251, 0.7);
  border: 0;
  border-radius: 4px;
  background: rgba(247, 245, 251, 0.07);
  place-items: center;
  cursor: pointer;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .managed-agent-dock {
    bottom: 18px;
  }
}
</style>

<style>
ion-modal.managed-agent-sheet {
  --background: #17131f;
  --border-radius: 10px 10px 0 0;
  --box-shadow: 0 -12px 36px rgba(23, 19, 31, 0.3);
}

ion-modal.managed-agent-sheet::part(handle) {
  background: #d4a853;
}
</style>
