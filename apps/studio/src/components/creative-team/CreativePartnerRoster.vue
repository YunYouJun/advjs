<script setup lang="ts">
import type { CreativePartnerId, CreativeTeamAvailability, CreativeTeamRun } from '@advjs/agent'
import { CREATIVE_PARTNER_DEFAULT_CAPABILITY, CREATIVE_PARTNER_IDS } from '@advjs/agent'
import { IonIcon } from '@ionic/vue'
import { brushOutline, clipboardOutline, colorPaletteOutline, micOutline, pencilOutline, peopleOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ selected: CreativePartnerId, availability?: CreativeTeamAvailability, run?: CreativeTeamRun }>()
defineEmits<{ select: [partner: CreativePartnerId] }>()
const { t } = useI18n()
const icons = { 'director': clipboardOutline, 'writer': pencilOutline, 'character-designer': peopleOutline, 'art-director': colorPaletteOutline, 'voice-director': micOutline, 'playtester': brushOutline }
const partners = computed(() => CREATIVE_PARTNER_IDS.map((id) => {
  const task = props.run?.plan.tasks.findLast(task => task.partner === id)
  const state = props.run?.tasks.find(item => item.taskId === task?.id)
  const latest = props.run?.artifacts.findLast(artifact => artifact.partner === id && ['candidate', 'selected', 'adopted'].includes(artifact.status))
  const enabled = props.availability?.enabled && props.availability.capabilities.includes(CREATIVE_PARTNER_DEFAULT_CAPABILITY[id])
  return { id, icon: icons[id], enabled, status: state?.status, subtitle: latest?.summary ?? (state ? t(`creativeTeam.status.${state.status}`) : t(`creativeTeam.duties.${id}`)) }
}))
</script>

<template>
  <div class="partner-roster" role="group" :aria-label="t('creativeTeam.choosePartner')">
    <button v-for="partner in partners" :key="partner.id" type="button" class="partner-roster__item" :class="{ 'partner-roster__item--selected': selected === partner.id }" :aria-pressed="selected === partner.id" @click="$emit('select', partner.id)">
      <IonIcon :icon="partner.icon" class="partner-roster__icon" aria-hidden="true" />
      <span class="partner-roster__body">
        <strong>{{ t(`creativeTeam.roles.${partner.id}`) }}</strong>
        <span class="partner-roster__subtitle">{{ partner.subtitle }}</span>
        <span v-if="!partner.enabled" class="partner-roster__unavailable">{{ t('creativeTeam.unavailable') }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.partner-roster {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--adv-space-sm);
}
.partner-roster__item {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
  text-align: start;
  cursor: pointer;
  min-width: 0;
}
.partner-roster__item--selected {
  border-color: var(--adv-primary);
  background: var(--adv-surface-elevated);
}
.partner-roster__item:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
  outline-offset: 2px;
}
.partner-roster__icon {
  flex-shrink: 0;
  font-size: 24px;
  color: var(--adv-primary);
}
.partner-roster__body {
  display: grid;
  gap: var(--adv-space-xs);
  min-width: 0;
  overflow-wrap: anywhere;
}
.partner-roster__subtitle {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.partner-roster__unavailable {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}
@media (max-width: 650px) {
  .partner-roster {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .partner-roster__item {
    padding: var(--adv-space-sm);
  }
}
</style>
