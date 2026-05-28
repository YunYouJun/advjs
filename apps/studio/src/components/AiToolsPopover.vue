<script setup lang="ts">
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
} from '@ionic/vue'
import {
  bulbOutline,
  peopleOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
} from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

defineProps<{
  trigger: string
}>()

const emit = defineEmits<{
  pickPlot: []
  pickRoleplay: []
  pickDraft: []
  pickConsistency: []
  dismiss: []
}>()

const { t } = useI18n()

function handlePick(action: 'plot' | 'roleplay' | 'draft' | 'consistency') {
  if (action === 'plot')
    emit('pickPlot')
  else if (action === 'roleplay')
    emit('pickRoleplay')
  else if (action === 'draft')
    emit('pickDraft')
  else if (action === 'consistency')
    emit('pickConsistency')
  emit('dismiss')
}
</script>

<template>
  <IonPopover
    :trigger="trigger"
    trigger-action="click"
    :dismiss-on-select="true"
  >
    <IonContent>
      <IonList>
        <IonItem button :detail="false" @click="handlePick('plot')">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="bulbOutline" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ t('aiAuthoring.plot.suggest') }}</h3>
            <p>{{ t('aiAuthoring.shortDesc.plot') }}</p>
          </IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="handlePick('roleplay')">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="peopleOutline" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ t('aiAuthoring.roleplay.run') }}</h3>
            <p>{{ t('aiAuthoring.shortDesc.roleplay') }}</p>
          </IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="handlePick('draft')">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="sparklesOutline" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ t('aiAuthoring.chapter.draft') }}</h3>
            <p>{{ t('aiAuthoring.shortDesc.draft') }}</p>
          </IonLabel>
        </IonItem>
        <IonItem button :detail="false" lines="none" @click="handlePick('consistency')">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="shieldCheckmarkOutline" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ t('aiAuthoring.consistency.run') }}</h3>
            <p>{{ t('aiAuthoring.shortDesc.consistency') }}</p>
          </IonLabel>
        </IonItem>
      </IonList>
    </IonContent>
  </IonPopover>
</template>

<style scoped>
ion-popover {
  --width: 280px;
}
</style>
