<script setup lang="ts">
import type { ViewMode } from '../stores/useViewModeStore'
import { IonIcon } from '@ionic/vue'
import { chatbubblesOutline, eyeOutline, gameControllerOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useViewModeStore } from '../stores/useViewModeStore'

const { t } = useI18n()
const viewModeStore = useViewModeStore()

const modes: { key: ViewMode, icon: string, labelKey: string }[] = [
  { key: 'character', icon: 'gameController', labelKey: 'world.viewModeCharacter' },
  { key: 'god', icon: 'eye', labelKey: 'world.viewModeGod' },
  { key: 'visitor', icon: 'chatbubbles', labelKey: 'world.viewModeVisitor' },
]

const iconMap: Record<string, any> = {
  gameController: gameControllerOutline,
  eye: eyeOutline,
  chatbubbles: chatbubblesOutline,
}
</script>

<template>
  <div class="view-mode-switcher">
    <div class="view-mode-label">
      {{ t('world.viewMode') }}
    </div>
    <div class="view-mode-segment">
      <button
        v-for="m in modes"
        :key="m.key"
        class="view-mode-segment__btn"
        :class="{ 'view-mode-segment__btn--active': viewModeStore.mode === m.key }"
        @click="viewModeStore.setMode(m.key)"
      >
        <IonIcon :icon="iconMap[m.icon]" class="view-mode-segment__icon" />
        <span class="view-mode-segment__text">{{ t(m.labelKey) }}</span>
      </button>
    </div>
  </div>
</template>
