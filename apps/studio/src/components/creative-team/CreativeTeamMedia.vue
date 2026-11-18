<script setup lang="ts">
import type { CreativeMediaEvidence } from '@advjs/agent'
import { useI18n } from 'vue-i18n'

defineProps<{ media: CreativeMediaEvidence }>()
const { t } = useI18n()
</script>

<template>
  <div class="team-media">
    <p>{{ t('creativeTeam.mediaMilestone.verification') }}</p>
    <p>{{ t('creativeTeam.mediaMilestone.verificationHint') }}</p>
    <dl class="team-media__facts">
      <dt>{{ t('creativeTeam.mediaMilestone.asset') }}</dt><dd>{{ media.target.assetId }}</dd>
      <dt>{{ t('creativeTeam.mediaMilestone.file') }}</dt><dd>{{ media.mediaPath }}</dd>
      <dt>{{ t('creativeTeam.mediaMilestone.bytes') }}</dt><dd>{{ media.bytes }} B · {{ media.mimeType }}</dd>
      <dt>SHA-256</dt><dd><code>{{ media.sha256 }}</code></dd>
      <template v-if="media.target.kind === 'voice'">
        <dt>{{ t('creativeTeam.mediaMilestone.binding') }}</dt><dd>{{ t(media.target.phase === 'registered' ? 'creativeTeam.mediaMilestone.unselectedBinding' : 'creativeTeam.mediaMilestone.selectedBinding') }}</dd>
        <dt>{{ t('creativeTeam.voiceImport.line') }}</dt><dd>{{ media.target.lineId }} · {{ media.target.locale }}</dd>
        <dt>VoiceTake</dt><dd>{{ media.target.takeId }}</dd>
      </template>
    </dl>
  </div>
</template>

<style scoped>
.team-media {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.team-media__facts {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--adv-space-xs);
}
.team-media__facts dt {
  font-weight: 600;
}
.team-media__facts dd {
  margin: 0 0 var(--adv-space-sm);
}
</style>
