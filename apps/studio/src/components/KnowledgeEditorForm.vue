<script setup lang="ts">
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title?: string
  domain?: string
  content?: string
  domains: string[]
  isEdit?: boolean
}>()

const emit = defineEmits<{
  update: [data: { title: string, domain: string, content: string }]
}>()

const { t } = useI18n()

const localTitle = ref(props.title || '')
const localDomain = ref(props.domain || 'general')
const localContent = ref(props.content || '')
const customDomain = ref('')

watch([localTitle, localDomain, localContent, customDomain], () => {
  const effectiveDomain = localDomain.value === '__custom__' ? customDomain.value : localDomain.value
  emit('update', {
    title: localTitle.value,
    domain: effectiveDomain || 'general',
    content: localContent.value,
  })
})

// Sync from props when editing
watch(() => props.title, v => localTitle.value = v || '')
watch(() => props.domain, v => localDomain.value = v || 'general')
watch(() => props.content, v => localContent.value = v || '')
</script>

<template>
  <IonList :inset="true">
    <IonListHeader>
      <IonLabel>{{ t('knowledge.basicInfo') }}</IonLabel>
    </IonListHeader>

    <!-- Title -->
    <IonItem>
      <IonInput
        v-model="localTitle"
        :label="t('knowledge.title')"
        :placeholder="t('knowledge.titlePlaceholder')"
        label-placement="stacked"
      />
    </IonItem>

    <!-- Domain -->
    <IonItem>
      <IonSelect
        v-model="localDomain"
        :label="t('knowledge.domain')"
        label-placement="stacked"
        interface="popover"
      >
        <IonSelectOption value="general">
          {{ t('knowledge.domainGeneral') }}
        </IonSelectOption>
        <IonSelectOption
          v-for="d in domains.filter(dd => dd !== 'general')"
          :key="d"
          :value="d"
        >
          {{ d }}
        </IonSelectOption>
        <IonSelectOption value="__custom__">
          {{ t('knowledge.domainCustom') }}
        </IonSelectOption>
      </IonSelect>
    </IonItem>

    <!-- Custom domain input -->
    <IonItem v-if="localDomain === '__custom__'">
      <IonInput
        v-model="customDomain"
        :label="t('knowledge.domainNew')"
        :placeholder="t('knowledge.domainNewPlaceholder')"
        label-placement="stacked"
      />
    </IonItem>
  </IonList>

  <IonList :inset="true">
    <IonListHeader>
      <IonLabel>{{ t('knowledge.content') }}</IonLabel>
    </IonListHeader>

    <IonItem>
      <IonTextarea
        v-model="localContent"
        :placeholder="t('knowledge.contentPlaceholder')"
        :rows="12"
        :auto-grow="true"
        class="knowledge-textarea"
      />
    </IonItem>
  </IonList>
</template>

<style scoped>
.knowledge-textarea {
  --padding-start: 0;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
}
</style>
