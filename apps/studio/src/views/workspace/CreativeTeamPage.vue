<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import CreativeTeamWorkspace from '../../components/creative-team/CreativeTeamWorkspace.vue'

const { t } = useI18n()
</script>

<template>
  <LayoutPage :title="t('creativeTeam.title')" :fullscreen="false" show-back-button default-href="/tabs/workspace">
    <CreativeTeamWorkspace />
  </LayoutPage>
</template>
