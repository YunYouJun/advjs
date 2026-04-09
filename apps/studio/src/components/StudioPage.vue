<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { ref } from 'vue'

withDefaults(defineProps<{
  title?: string
  defaultHref?: string
  showBackButton?: boolean
  fullscreen?: boolean
  scrollY?: boolean
}>(), {
  title: undefined,
  defaultHref: undefined,
  showBackButton: false,
  fullscreen: true,
  scrollY: undefined,
})

const contentRef = ref<InstanceType<typeof IonContent> | null>(null)

defineExpose({
  contentRef,
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <slot name="start">
            <IonBackButton v-if="showBackButton" :default-href="defaultHref" />
          </slot>
        </IonButtons>
        <IonTitle>
          <slot name="title">
            {{ title }}
          </slot>
        </IonTitle>
        <IonButtons slot="end">
          <slot name="end" />
        </IonButtons>
        <!-- eslint-enable vue/no-deprecated-slot-attribute -->
      </IonToolbar>
      <slot name="header-extra" />
    </IonHeader>

    <IonContent ref="contentRef" :fullscreen="fullscreen" :scroll-y="scrollY">
      <slot />
    </IonContent>

    <IonFooter v-if="$slots.footer">
      <slot name="footer" />
    </IonFooter>
  </IonPage>
</template>
