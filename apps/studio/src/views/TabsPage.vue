<script setup lang="ts">
import { IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { ellipse, square, triangle } from 'ionicons/icons'
</script>

<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />
      <template #bottom>
        <IonTabBar>
          <IonTabButton tab="tab1" href="/tabs/tab1">
            <IonIcon aria-hidden="true" :icon="triangle" />
            <IonLabel>Tab 1</IonLabel>
          </IonTabButton>

          <IonTabButton tab="tab2" href="/tabs/tab2">
            <IonIcon aria-hidden="true" :icon="ellipse" />
            <IonLabel>Tab 2</IonLabel>
          </IonTabButton>

          <IonTabButton tab="tab3" href="/tabs/tab3">
            <IonIcon aria-hidden="true" :icon="square" />
            <IonLabel>Tab 3</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </template>
    </IonTabs>
  </IonPage>
</template>
