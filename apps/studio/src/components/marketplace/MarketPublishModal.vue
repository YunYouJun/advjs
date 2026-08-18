<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { MarketDuration, MarketGenre, MarketStyle } from '../../utils/marketTaxonomy'
import {
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  deriveDuration,
  MARKET_DURATIONS,
  MARKET_GENRES,
  MARKET_STYLES,
} from '../../utils/marketTaxonomy'

const props = defineProps<{
  isOpen: boolean
  projectName: string
  description?: string
  chapterCount: number
  characters: AdvCharacter[]
  worldMd?: string
  isPublishing: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'publish', payload: {
    tags: string[]
    genre?: MarketGenre
    style?: MarketStyle
    duration: MarketDuration
  }): void
}>()

const { t } = useI18n()

const tags = ref<string[]>([])
const tagInput = ref('')
const genre = ref<MarketGenre | undefined>(undefined)
const style = ref<MarketStyle | undefined>(undefined)
const duration = ref<MarketDuration>('short')

// Reset the form each time the modal opens so a re-publish starts clean and
// duration reflects the current chapter count.
watch(() => props.isOpen, (open) => {
  if (open) {
    tags.value = []
    tagInput.value = ''
    genre.value = undefined
    style.value = undefined
    duration.value = deriveDuration(props.chapterCount)
  }
})

function addTag() {
  const raw = tagInput.value.trim().replace(/^#+/, '').slice(0, 16).trim()
  tagInput.value = ''
  if (!raw)
    return
  if (tags.value.some(t => t.toLowerCase() === raw.toLowerCase()))
    return
  if (tags.value.length >= 8)
    return
  tags.value.push(raw)
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
}

function toggleGenre(id: MarketGenre) {
  genre.value = genre.value === id ? undefined : id
}

function toggleStyle(id: MarketStyle) {
  style.value = style.value === id ? undefined : id
}

function handlePublish() {
  emit('publish', {
    tags: tags.value,
    genre: genre.value,
    style: style.value,
    duration: duration.value,
  })
}
</script>

<template>
  <IonModal :is-open="isOpen" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('marketplace.publishTitle') }}</IonTitle>
        <IonButtons slot="end">
          <button type="button" class="pub-close-btn" @click="emit('close')">
            <IonIcon :icon="closeOutline" />
          </button>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="pub-form">
        <p class="pub-project">
          {{ projectName }}
        </p>

        <!-- Genre -->
        <section class="pub-section">
          <h4 class="pub-label">
            {{ t('marketplace.genreLabel') }}
          </h4>
          <div class="pub-chips">
            <IonChip
              v-for="opt in MARKET_GENRES"
              :key="opt.id"
              :color="genre === opt.id ? 'primary' : undefined"
              @click="toggleGenre(opt.id)"
            >
              {{ opt.icon }} {{ t(opt.labelKey) }}
            </IonChip>
          </div>
        </section>

        <!-- Style -->
        <section class="pub-section">
          <h4 class="pub-label">
            {{ t('marketplace.styleLabel') }}
          </h4>
          <div class="pub-chips">
            <IonChip
              v-for="opt in MARKET_STYLES"
              :key="opt.id"
              :color="style === opt.id ? 'primary' : undefined"
              @click="toggleStyle(opt.id)"
            >
              {{ opt.icon }} {{ t(opt.labelKey) }}
            </IonChip>
          </div>
        </section>

        <!-- Duration -->
        <section class="pub-section">
          <h4 class="pub-label">
            {{ t('marketplace.durationLabel') }}
          </h4>
          <div class="pub-chips">
            <IonChip
              v-for="opt in MARKET_DURATIONS"
              :key="opt.id"
              :color="duration === opt.id ? 'primary' : undefined"
              @click="duration = opt.id"
            >
              {{ opt.icon }} {{ t(opt.labelKey) }}
            </IonChip>
          </div>
        </section>

        <!-- Free-form tags -->
        <section class="pub-section">
          <h4 class="pub-label">
            {{ t('marketplace.tagsLabel') }}
          </h4>
          <div v-if="tags.length" class="pub-chips">
            <IonChip
              v-for="tag in tags"
              :key="tag"
              color="medium"
              @click="removeTag(tag)"
            >
              {{ tag }}
              <IonIcon :icon="closeOutline" />
            </IonChip>
          </div>
          <IonInput
            v-model="tagInput"
            class="pub-tag-input"
            fill="outline"
            :placeholder="t('marketplace.tagPlaceholder')"
            @keyup.enter="addTag"
          />
        </section>

        <button
          type="button"
          class="pub-submit"
          :disabled="isPublishing"
          @click="handlePublish"
        >
          <IonSpinner v-if="isPublishing" name="dots" />
          <span v-else>{{ t('marketplace.publish') }}</span>
        </button>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.pub-close-btn {
  background: none;
  border: none;
  font-size: var(--adv-font-subtitle);
  color: var(--adv-text-secondary);
  cursor: pointer;
  padding: 8px;
  display: flex;
}

.pub-form {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.pub-project {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  margin: 0;
  color: var(--adv-text-primary);
}

.pub-ai-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--ion-color-primary);
  background: transparent;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  cursor: pointer;
}

.pub-ai-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pub-section {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.pub-label {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  margin: 0;
  color: var(--adv-text-secondary);
}

.pub-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pub-tag-input {
  --padding-start: 12px;
  font-size: var(--adv-font-body-sm);
}

.pub-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--adv-space-sm);
  padding: 12px 24px;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-gradient-primary);
  color: #fff;
  font-size: var(--adv-font-body);
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.pub-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
