<script setup lang="ts">
import { IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { chatbubbleOutline, layersOutline, personOutline, playOutline } from 'ionicons/icons'
import { onMounted } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'

const studioStore = useStudioStore()

// Auto-restore last project on page reload (global, runs once for all tabs)
onMounted(() => {
  if (!studioStore.currentProject)
    studioStore.autoRestoreLastProject()
})
</script>

<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonTabBar slot="bottom">
        <IonTabButton tab="workspace" href="/tabs/workspace">
          <IonIcon aria-hidden="true" :icon="layersOutline" />
          <IonLabel>{{ $t('tabs.workspace') }}</IonLabel>
        </IonTabButton>

        <IonTabButton tab="chat" href="/tabs/chat">
          <IonIcon aria-hidden="true" :icon="chatbubbleOutline" />
          <IonLabel>{{ $t('tabs.chat') }}</IonLabel>
        </IonTabButton>

        <IonTabButton tab="play" href="/tabs/play">
          <IonIcon aria-hidden="true" :icon="playOutline" />
          <IonLabel>{{ $t('tabs.play') }}</IonLabel>
        </IonTabButton>

        <IonTabButton tab="me" href="/tabs/me">
          <IonIcon aria-hidden="true" :icon="personOutline" />
          <IonLabel>{{ $t('tabs.me') }}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </IonPage>
</template>
