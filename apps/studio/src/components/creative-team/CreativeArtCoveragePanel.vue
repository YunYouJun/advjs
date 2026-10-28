<script setup lang="ts">
import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportHost } from '../../composables/useCreativeArtImport'
import { useI18n } from 'vue-i18n'
import { useCreativeArtCoverage } from '../../composables/useCreativeArtCoverage'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ run: CreativeTeamRun, disabled: boolean, host: () => Promise<CreativeArtImportHost> }>()
const { t } = useI18n()
const { result, loading, error, issues, load } = useCreativeArtCoverage({ scope: () => `${props.run.accountId}:${props.run.plan.projectId}:${props.run.id}:${props.run.revision}`, run: () => props.run, host: () => props.host() })
</script>

<template>
  <section class="art-coverage" data-testid="creative-art-coverage">
    <h3>{{ t('creativeTeam.artCoverage.title') }}</h3>
    <p>{{ t('creativeTeam.artCoverage.hint') }}</p>
    <SButton size="lg" variant="outline" :disabled="disabled" :loading="loading" @click="load">
      {{ t('creativeTeam.artCoverage.inspect') }}
    </SButton>
    <p v-if="error" role="alert">
      {{ t('creativeTeam.artCoverage.error') }}
    </p>
    <template v-if="result">
      <p role="status">
        {{ t('creativeTeam.artCoverage.count', { total: result.rows.length, issues }) }}
      </p>
      <p>{{ t('creativeTeam.source') }} · {{ result.revision }}</p>
      <p v-if="!result.complete" role="status">
        {{ t('creativeTeam.artCoverage.incomplete') }}
      </p>
      <details v-if="result.diagnostics.length">
        <summary>{{ t('creativeTeam.voiceCoverage.diagnostics') }} · {{ result.diagnostics.length }}</summary>
        <p v-for="(diagnostic, index) in result.diagnostics" :key="index">
          {{ diagnostic.path }}:{{ diagnostic.line }} · {{ diagnostic.code }} · {{ diagnostic.message }}
        </p>
      </details>
      <ul>
        <li v-for="row in result.rows" :key="`${row.artifactId}:${row.request.assetId}`" :data-status="row.status" :data-asset-id="row.request.assetId">
          <strong>{{ row.request.assetId }}</strong> · {{ t(`creativeTeam.artCoverage.status.${row.status}`) }}
          <p>{{ row.request.characterId || row.request.sceneId }}<span v-if="row.request.expression"> · {{ row.request.expression }}</span></p>
          <details v-if="row.path">
            <summary>{{ t('creativeTeam.artCoverage.details') }}</summary>
            <p>{{ row.path }} · {{ row.width }} × {{ row.height }} · {{ row.sha256 }}</p>
          </details>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.art-coverage {
  margin-block: var(--adv-space-lg);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.art-coverage ul {
  padding-inline-start: var(--adv-space-lg);
}
.art-coverage li {
  margin-block: var(--adv-space-md);
}
.art-coverage p {
  color: var(--adv-text-secondary);
}
.art-coverage summary {
  cursor: pointer;
  min-height: 44px;
}
.art-coverage summary:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
