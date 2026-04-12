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
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{
  title?: string
  subtitle?: string
  defaultHref?: string
  showBackButton?: boolean
  fullscreen?: boolean
  scrollY?: boolean
}>(), {
  title: undefined,
  subtitle: undefined,
  defaultHref: undefined,
  showBackButton: false,
  fullscreen: true,
  scrollY: undefined,
})

const { t } = useI18n()
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
            <IonBackButton v-if="showBackButton" :text="t('common.back')" :default-href="defaultHref" />
          </slot>
        </IonButtons>
        <IonTitle>
          <slot name="title">
            {{ title }}
          </slot>
          <div v-if="subtitle || $slots.subtitle" class="layout-page-subtitle">
            <slot name="subtitle">
              {{ subtitle }}
            </slot>
          </div>
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

<style scoped>
.layout-page-subtitle {
  font-size: 0.7rem;
  font-weight: normal;
  opacity: 0.6;
  line-height: 1.2;
}
</style>
