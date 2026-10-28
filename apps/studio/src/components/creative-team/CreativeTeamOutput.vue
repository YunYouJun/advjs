<script setup lang="ts">
import type { CreativePartnerOutput } from '@advjs/agent'
import { useI18n } from 'vue-i18n'
import CreativeDirectorSummaryOutput from './CreativeDirectorSummaryOutput.vue'
import CreativeNarrativeEvidence from './CreativeNarrativeEvidence.vue'

defineProps<{ output: CreativePartnerOutput }>()
const { t } = useI18n()
</script>

<template>
  <div class="team-output">
    <CreativeDirectorSummaryOutput v-if="output.kind === 'delivery-summary'" :output="output" />
    <ol v-else-if="output.kind === 'production-plan'" class="team-output__list">
      <li v-for="task in output.plan.tasks" :key="task.id">
        <strong>{{ t(`creativeTeam.roles.${task.partner}`) }}</strong> · {{ task.instruction }}
        <p>{{ task.expectedOutput }}</p>
        <p v-if="task.dependsOn.length">
          {{ t('creativeTeam.depends') }}: {{ task.dependsOn.join(', ') }}
        </p>
      </li>
    </ol>
    <template v-else-if="output.kind === 'characters'">
      <article v-for="character in output.characters" :key="character.id" class="team-output__item">
        <h4>{{ character.name }} · {{ character.id }}</h4>
        <p>{{ character.description }}</p>
        <p><strong>{{ t('creativeTeam.motivation') }}:</strong> {{ character.motivation }}</p>
        <p><strong>{{ t('creativeTeam.speaking') }}:</strong> {{ character.speakingStyle }}</p>
        <p><strong>{{ t('creativeTeam.visual') }}:</strong> {{ character.visualConstraints.join('；') }}</p>
        <p><strong>{{ t('creativeTeam.voice') }}:</strong> {{ character.voiceConstraints.join('；') }}</p>
        <ul v-if="character.relationships.length">
          <li v-for="relation in character.relationships" :key="relation.targetId">
            {{ relation.targetId }} · {{ relation.type }}: {{ relation.description }}
          </li>
        </ul>
      </article>
    </template>
    <template v-else-if="output.kind === 'chapter'">
      <details v-for="chapter in output.chapters" :key="chapter.id" class="team-output__item">
        <summary>{{ chapter.title }}</summary>
        <pre class="team-output__source">{{ chapter.content }}</pre>
      </details>
    </template>
    <template v-else-if="output.kind === 'art-direction'">
      <p>{{ output.style }}</p>
      <article v-for="request in output.requests" :key="request.assetId" class="team-output__item">
        <strong>{{ request.assetId }}</strong> · {{ request.width }} × {{ request.height }}
        <p>{{ request.characterId || request.sceneId }} <span v-if="request.locationId">· {{ request.locationId }}</span></p>
        <p>{{ request.prompt }}</p>
        <ul>
          <li v-for="constraint in request.constraints" :key="constraint">
            {{ constraint }}
          </li>
        </ul>
      </article>
      <p class="team-output__notice">
        {{ t('creativeTeam.missingMedia') }}
      </p>
      <RouterLink to="/tabs/workspace/scenes">
        {{ t('creativeTeam.artResources') }}
      </RouterLink>
    </template>
    <template v-else-if="output.kind === 'voice-direction'">
      <p v-if="output.locale">
        {{ t('creativeTeam.voicePlan.locale') }} · {{ output.locale }}
      </p>
      <h4>{{ t('creativeTeam.cast') }}</h4>
      <article v-for="cast in output.cast" :key="cast.speakerId" class="team-output__item">
        <strong>{{ cast.speakerId }}</strong>
        <p>{{ cast.designBrief }}</p><p>{{ cast.performance }}</p>
        <p v-if="cast.intent">
          {{ t('creativeTeam.voicePlan.intent') }} · {{ Object.values(cast.intent).flat().join(' · ') }}
        </p>
      </article>
      <h4 v-if="output.dictionary.length">
        {{ t('creativeTeam.dictionary') }}
      </h4>
      <p v-for="term in output.dictionary" :key="term.term">
        {{ term.term }}: {{ term.pronunciation }}
      </p>
      <h4>{{ t('creativeTeam.lines') }}</h4>
      <blockquote v-for="line in output.lines" :key="`${line.path}:${line.lineId ?? line.line}`">
        <p class="team-output__voice-text">
          {{ line.speakerId }}: {{ line.text }}
        </p>
        <p>{{ line.instruction }}</p>
        <small>{{ line.path }}{{ line.source ? `:${line.source.line}–${line.source.endLine}` : '' }} · {{ line.lineId ?? line.line }}</small>
      </blockquote>
      <p class="team-output__notice">
        {{ t('creativeTeam.voiceHandoff') }}
      </p>
      <RouterLink to="/tabs/workspace/audio">
        {{ t('creativeTeam.voiceResources') }}
      </RouterLink>
    </template>
    <template v-else-if="output.kind === 'playtest-plan'">
      <p class="team-output__notice">
        {{ t('creativeTeam.testPlan') }}
      </p>
      <article v-for="scenario in output.scenarios" :key="scenario.id" class="team-output__item">
        <strong>{{ scenario.id }}</strong>
        <p>{{ t('creativeTeam.expected') }}: {{ scenario.expectedEnding }}</p>
        <p>{{ t('creativeTeam.choices') }}: {{ scenario.choices.join(' → ') }}</p>
      </article>
      <h4 v-if="output.concerns.length">
        {{ t('creativeTeam.concerns') }}
      </h4>
      <article v-for="concern in output.concerns" :key="`${concern.path}:${concern.line}`" class="team-output__item">
        <strong>{{ concern.path }}:{{ concern.line }}</strong>
        <CreativeNarrativeEvidence :concern="concern" />
      </article>
    </template>
  </div>
</template>

<style scoped>
.team-output {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.team-output__list {
  padding-inline-start: 20px;
}
.team-output__item {
  padding-block: var(--adv-space-sm);
  border-bottom: 1px solid var(--adv-border-subtle);
}
.team-output__source {
  white-space: pre-wrap;
  font-family: var(--adv-font-mono);
  font-size: var(--adv-font-body-sm);
}
.team-output__voice-text {
  white-space: pre-wrap;
}
.team-output__notice {
  border-inline-start: 3px solid var(--adv-accent);
  padding-inline-start: var(--adv-space-sm);
  color: var(--adv-text-secondary);
}
</style>
