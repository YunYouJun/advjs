<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import { inspectMusicReview } from '@advjs/audio'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ asset?: AdvAssetEntry, active: boolean, busy: boolean }>()
const emit = defineEmits<{ apply: [asset: AdvAssetEntry] }>()
const { t } = useI18n()
const confirmed = shallowRef(false)
const canBind = computed(() => props.asset && inspectMusicReview(props.asset).canBind)
watch([() => JSON.stringify(props.asset), () => props.active], () => confirmed.value = false)
</script>

<template>
  <section class="flow-music-binding" data-testid="flow-music-binding">
    <h3>{{ t('musicWorkflow.bindTitle') }}</h3>
    <p>{{ asset?.title || asset?.id || t('musicWorkflow.assetMissing') }}</p>
    <p>{{ t('musicWorkflow.bindHint') }}</p>
    <p v-if="!canBind" role="status">
      {{ t('musicWorkflow.reviewRequired') }}
    </p>
    <template v-else>
      <code>{{ asset!.id }} · {{ asset!.sha256 }}</code>
      <label><input v-model="confirmed" type="checkbox" :disabled="busy || !active">{{ t('musicWorkflow.confirmBinding') }}</label>
      <SButton size="lg" :disabled="!confirmed || busy || !active" @click="emit('apply', asset!)">
        {{ t('musicWorkflow.applyEntry') }}
      </SButton>
    </template>
  </section>
</template>

<style scoped>
.flow-music-binding {
  display: grid;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  min-width: 0;
}
.flow-music-binding h3,
.flow-music-binding p {
  margin: 0;
}
.flow-music-binding p,
.flow-music-binding code {
  color: var(--adv-text-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.flow-music-binding label {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: var(--adv-space-sm);
}
.flow-music-binding input {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  accent-color: var(--adv-primary);
}
.flow-music-binding input[type='checkbox']:focus-visible {
  outline: 3px solid var(--adv-primary);
  outline-offset: 2px;
}
.flow-music-binding :deep(.s-button) {
  white-space: normal;
}
</style>
