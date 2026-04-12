<script setup lang="ts">
import type { LocationInfo } from '../composables/useProjectContent'
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
} from '@ionic/vue'
import { businessOutline, leafOutline, locationOutline, prismOutline } from 'ionicons/icons'
import { computed } from 'vue'

const props = defineProps<{
  location: LocationInfo
}>()

defineEmits<{
  click: [location: LocationInfo]
}>()

const typeIcon = computed(() => {
  switch (props.location.type) {
    case 'indoor': return businessOutline
    case 'outdoor': return leafOutline
    case 'virtual': return prismOutline
    default: return locationOutline
  }
})
</script>

<template>
  <IonCard class="location-card" button @click="$emit('click', location)">
    <IonCardHeader>
      <IonCardTitle class="location-card__title">
        <IonIcon :icon="typeIcon" class="location-card__icon" />
        {{ location.name }}
      </IonCardTitle>
    </IonCardHeader>
    <IonCardContent>
      <p v-if="location.description" class="location-card__desc">
        {{ location.description }}
      </p>
      <p v-else class="location-card__file">
        {{ location.file }}
      </p>
      <div v-if="location.tags?.length" class="location-card__tags">
        <span v-for="tag in location.tags.slice(0, 3)" :key="tag" class="location-card__tag">
          {{ tag }}
        </span>
      </div>
      <div v-if="location.linkedScenes?.length" class="location-card__meta">
        {{ $t('locations.linkedScenesCount', { count: location.linkedScenes.length }) }}
      </div>
    </IonCardContent>
  </IonCard>
</template>

<style scoped>
.location-card {
  margin: 0;
  overflow: hidden;
}

.location-card__title {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  font-size: var(--adv-font-body);
  font-weight: 600;
}

.location-card__icon {
  flex-shrink: 0;
  color: #10b981;
}

.location-card__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.location-card__file {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}

.location-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: var(--adv-space-xs);
}

.location-card__tag {
  font-size: 10px;
  line-height: 1;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(16, 185, 129, 0.08);
  color: #10b981;
  white-space: nowrap;
}

.location-card__meta {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin-top: var(--adv-space-xs);
}
</style>
