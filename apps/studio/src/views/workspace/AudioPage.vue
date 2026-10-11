<script setup lang="ts">
import { onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AudioWorkspace from '../../components/audio/AudioWorkspace.vue'
import LayoutPage from '../../components/common/LayoutPage.vue'

const { t } = useI18n()
const route = useRoute()
const previewActive = shallowRef(true)
watch(() => route.path, path => previewActive.value = path === '/tabs/workspace/audio', { immediate: true })
onIonViewWillEnter(() => previewActive.value = true)
onIonViewWillLeave(() => previewActive.value = false)
</script>

<template>
  <LayoutPage :title="t('audioWorkspace.title')" show-back-button default-href="/tabs/workspace">
    <AudioWorkspace :active="previewActive" />
  </LayoutPage>
</template>
