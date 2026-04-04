<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  logoGithub,
  openOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import NavGroup from '../../components/ui/NavGroup.vue'
import NavItem from '../../components/ui/NavItem.vue'

const { t } = useI18n()
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton :text="t('common.back')" default-href="/tabs/me" />
        </IonButtons>
        <IonTitle>{{ t('feedback.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ t('feedback.title') }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="page-container">
        <NavGroup>
          <NavItem
            :icon="logoGithub"
            :label="t('feedback.github')"
            :desc="t('feedback.githubDesc')"
            :trailing-icon="openOutline"
            :chevron="false"
            href="https://github.com/YunYouJun/advjs/issues/new"
          />
        </NavGroup>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page-container {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  max-width: 560px;
  margin: 0 auto;
}
</style>
