<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import ExploreContainer from '@/components/ExploreContainer.vue'
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Tab 2</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            Tab 2
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <ExploreContainer name="Tab 2 page" />
    </IonContent>
  </IonPage>
</template>
