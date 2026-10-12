<script setup lang="ts">
import { onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AudioWorkspace from '../../components/audio/AudioWorkspace.vue'
import LayoutPage from '../../components/common/LayoutPage.vue'
import { readVoiceWorkflowQuery } from '../../utils/voiceWorkflow'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const workflow = computed(() => readVoiceWorkflowQuery(route.query))
const previewActive = shallowRef(true)
watch(() => route.path, path => previewActive.value = path === '/tabs/workspace/audio', { immediate: true })
onIonViewWillEnter(() => previewActive.value = true)
onIonViewWillLeave(() => previewActive.value = false)
</script>

<template>
  <LayoutPage :title="t('audioWorkspace.title')" show-back-button default-href="/tabs/workspace">
    <AudioWorkspace :active="previewActive" :initial-section="workflow.section" :speaker-id="workflow.speakerId" :line-id="workflow.lineId" @play="router.push('/tabs/play')" @bind-music="router.push({ path: '/tabs/workspace/chapters', query: { music: $event } })" />
  </LayoutPage>
</template>
