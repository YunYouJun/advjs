<script setup lang="ts">
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonPopover } from '@ionic/vue'
import { expandOutline, folderOpenOutline, gitNetworkOutline, imageOutline, refreshOutline, saveOutline, settingsOutline, shareOutline, statsChartOutline } from 'ionicons/icons'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ action: [value: 'save' | 'load' | 'gallery' | 'stats' | 'branches' | 'share' | 'fullscreen' | 'restart' | 'settings'] }>()
const { t } = useI18n()
const open = shallowRef(false)
const event = shallowRef<Event>()
const actions = [
  { id: 'save', label: 'preview.save', icon: saveOutline },
  { id: 'load', label: 'preview.load', icon: folderOpenOutline },
  { id: 'gallery', label: 'preview.cgGallery', icon: imageOutline },
  { id: 'stats', label: 'preview.stats', icon: statsChartOutline },
  { id: 'branches', label: 'preview.branchGraph', icon: gitNetworkOutline },
  { id: 'share', label: 'preview.share', icon: shareOutline },
  { id: 'fullscreen', label: 'preview.fullscreen', icon: expandOutline },
] as const
function choose(action: typeof actions[number]['id'] | 'restart' | 'settings') {
  open.value = false
  emit('action', action)
}
</script>

<template>
  <div class="play-toolbar-actions" data-testid="play-toolbar-actions">
    <IonButton v-for="action in actions" :key="action.id" class="play-toolbar-actions__secondary" fill="clear" :aria-label="t(action.label)" @click="choose(action.id)">
      <IonIcon slot="icon-only" :icon="action.icon" />
    </IonButton>
    <IonButton fill="clear" :aria-label="t('preview.settings')" @click="event = $event; open = true">
      <IonIcon slot="icon-only" :icon="settingsOutline" />
    </IonButton>
  </div>
  <IonPopover :is-open="open" :event="event" :translucent="true" :dismiss-on-select="true" class="adv-settings-popover" @did-dismiss="open = false">
    <IonList lines="none" class="adv-popover-menu">
      <IonItem v-for="action in actions" :key="action.id" class="play-toolbar-actions__mobile" button :detail="false" @click="choose(action.id)">
        <IonIcon slot="start" :icon="action.icon" />
        <IonLabel>{{ t(action.label) }}</IonLabel>
      </IonItem>
      <IonItem button :detail="false" @click="choose('restart')">
        <IonIcon slot="start" :icon="refreshOutline" />
        <IonLabel>{{ t('preview.restart') }}</IonLabel>
      </IonItem>
      <IonItem button :detail="false" @click="choose('settings')">
        <IonIcon slot="start" :icon="settingsOutline" />
        <IonLabel>{{ t('preview.goSettings') }}</IonLabel>
      </IonItem>
    </IonList>
  </IonPopover>
</template>

<style scoped>
.play-toolbar-actions {
  display: flex;
  align-items: center;
}
.play-toolbar-actions__mobile {
  display: none;
}
@media (max-width: 767px) {
  .play-toolbar-actions__secondary {
    display: none;
  }
  .play-toolbar-actions__mobile {
    display: flex;
  }
}
</style>
