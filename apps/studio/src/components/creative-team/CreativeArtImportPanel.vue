<script setup lang="ts">
import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportHost } from '../../composables/useCreativeArtImport'
import type { CreativeMediaSubmit } from '../../utils/creativeMediaCandidate'
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreativeArtImport } from '../../composables/useCreativeArtImport'
import { assertCreativeArtImport } from '../../utils/creativeArtImport'
import CreativeArtImportCandidate from './CreativeArtImportCandidate.vue'
import CreativeArtImportForm from './CreativeArtImportForm.vue'

const props = defineProps<{ run: CreativeTeamRun, busy: boolean, host: () => Promise<CreativeArtImportHost>, submitMedia?: CreativeMediaSubmit }>()
const emit = defineEmits<{ busy: [value: boolean], changed: [] }>()
const { t } = useI18n()
const session = useCreativeArtImport({ run: () => props.run, host: () => props.host(), changed: () => emit('changed'), submitMedia: () => props.submitMedia })
const { rows, busy, error, inspections } = session
const visible = computed(() => rows.value.length || props.run.artifacts.some(item => item.output?.kind === 'art-direction' && ['selected', 'adopted'].includes(item.status)))
const blocked = computed(() => props.busy || busy.value || props.run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)) || Boolean(props.run.milestones?.some(item => item.status === 'prepared')))
const candidates = computed(() => rows.value.map((entry) => {
  let stale = false
  try {
    if (entry.managed) {
      const parent = props.run.artifacts.find(item => item.id === entry.artifactId && item.fingerprint === entry.artifactFingerprint)
      if (!parent || !['selected', 'adopted'].includes(parent.status))
        throw new Error('Source changed')
    }
    else {
      assertCreativeArtImport(props.run, entry)
    }
  }
  catch {
    stale = true
  }
  return { entry, stale }
}))
watch(busy, value => emit('busy', value))
onBeforeUnmount(() => emit('busy', false))
</script>

<template>
  <section v-if="visible" class="art-import" data-testid="creative-art-import">
    <h2 class="art-import__title">
      {{ t('creativeTeam.artImport.title') }}
    </h2>
    <p>{{ t('creativeTeam.artImport.hint') }}</p>
    <p>{{ t(submitMedia ? 'creativeTeam.mediaMilestone.scope' : 'creativeTeam.artImport.localScope') }}</p>
    <p v-if="error" class="art-import__error" role="alert">
      {{ t(`creativeTeam.artImport.error.${error}`) }}
    </p>
    <CreativeArtImportForm :run="run" :disabled="blocked" @stage="session.stage" />
    <CreativeArtImportCandidate v-for="candidate in candidates" :key="candidate.entry.id" v-bind="candidate" :disabled="blocked" :actual="inspections[candidate.entry.id]" :host="host" :managed-available="Boolean(submitMedia)" @review="session.review(candidate.entry.id, $event)" @adopt="session.adopt(candidate.entry.id)" @undo="session.undo(candidate.entry.id)" @reconcile="session.reconcile(candidate.entry.id)" @abandon="session.abandon(candidate.entry.id)" @restore="session.restore(candidate.entry.id)" @discard="session.discard(candidate.entry.id)" />
  </section>
</template>

<style scoped>
.art-import {
  border-top: 1px solid var(--adv-border-subtle);
  margin-top: var(--adv-space-lg);
  padding-top: var(--adv-space-lg);
  min-width: 0;
  line-height: 1.6;
}
.art-import__title {
  font-size: var(--adv-font-title);
}
.art-import__error {
  color: var(--adv-danger);
}
</style>
