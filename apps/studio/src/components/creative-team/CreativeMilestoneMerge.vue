<script setup lang="ts">
import type { CreativeMilestoneConflict } from '@advjs/agent'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ conflict: CreativeMilestoneConflict, draft?: { after: string | null, confirmed: boolean }, disabled: boolean }>()
const emit = defineEmits<{ update: [after: string | null, confirmed: boolean] }>()
const { t } = useI18n()
const value = () => props.draft?.after ?? ''
</script>

<template>
  <section class="merge" data-testid="creative-milestone-merge">
    <h3 class="merge__title">
      {{ t('creativeTeam.merge.title') }} · {{ conflict.path }}
    </h3>
    <p v-if="!conflict.editable" role="status">
      {{ t('creativeTeam.merge.unsupported') }}
    </p>
    <template v-else>
      <p>{{ t('creativeTeam.merge.hint') }}</p>
      <details>
        <summary>{{ t('creativeTeam.milestone.before') }}</summary>
        <pre>{{ conflict.before ?? t('creativeTeam.milestone.absent') }}</pre>
      </details>
      <details v-for="item in conflict.contributions" :key="item.artifactId">
        <summary>{{ item.summary }}</summary>
        <pre>{{ item.after ?? t('creativeTeam.milestone.absent') }}</pre>
        <SButton variant="outline" size="lg" :disabled="disabled" @click="emit('update', item.after, false)">
          {{ t('creativeTeam.merge.useInput') }}
        </SButton>
      </details>
      <fieldset :disabled="disabled" class="merge__form">
        <label>
          {{ t('creativeTeam.merge.result') }}
          <textarea :value="value()" :disabled="draft?.after === null" rows="9" maxlength="49152" spellcheck="false" @input="emit('update', ($event.target as HTMLTextAreaElement).value, false)" />
        </label>
        <label class="merge__check">
          <input type="checkbox" :checked="draft?.after === null" @change="emit('update', ($event.target as HTMLInputElement).checked ? null : '', false)">
          {{ t('creativeTeam.merge.delete') }}
        </label>
        <label class="merge__check">
          <input type="checkbox" :checked="draft?.confirmed ?? false" :disabled="!draft" @change="emit('update', draft!.after, ($event.target as HTMLInputElement).checked)">
          {{ t('creativeTeam.merge.confirm') }}
        </label>
      </fieldset>
    </template>
  </section>
</template>

<style scoped>
.merge {
  margin-block: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
  overflow-wrap: anywhere;
}
.merge__title {
  font-size: var(--adv-font-body);
}
.merge__form {
  border: 0;
  padding: 0;
  margin-top: var(--adv-space-md);
  min-width: 0;
}
.merge__form label {
  display: grid;
  gap: var(--adv-space-sm);
}
.merge__form .merge__check {
  display: flex;
  align-items: center;
  min-height: 44px;
}
.merge__check input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--adv-primary);
}
.merge textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 180px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-page);
  color: var(--adv-text-primary);
  padding: var(--adv-space-sm);
  font: inherit;
}
.merge summary {
  min-height: 44px;
  cursor: pointer;
}
.merge pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 280px;
  overflow-y: auto;
  font-size: var(--adv-font-body-sm);
}
.merge :is(input, textarea, summary):focus-visible {
  outline: 3px solid var(--adv-primary-soft);
  outline-offset: 2px;
}
</style>
