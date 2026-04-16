<script setup lang="ts">
import type { AdvCharacter, AdvCharacterRelationship } from '@advjs/types'
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  toastController,
} from '@ionic/vue'
import { addOutline, closeCircleOutline, imageOutline, sparklesOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { buildImagePromptTemplate, generateImage, isImageGenerationAvailable } from '../utils/aiImageClient'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'
import RelationshipEditor from './RelationshipEditor.vue'
import TagsInput from './TagsInput.vue'

defineProps<{
  characters?: AdvCharacter[]
}>()

const { t } = useI18n()
const aiSettings = useAiSettingsStore()
const model = defineModel<AdvCharacter>({ required: true })
const isGeneratingImage = ref(false)

function updateField<K extends keyof AdvCharacter>(field: K, value: AdvCharacter[K]) {
  model.value = { ...model.value, [field]: value }
}

// --- Avatar ---
const avatarInputRef = ref<HTMLInputElement>()

const avatarPreviewUrl = computed(() => getValidAvatarUrl(model.value.avatar))

const avatarInitials = computed(() => getCharacterInitials(model.value.name || model.value.id))

function triggerAvatarUpload() {
  avatarInputRef.value?.click()
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

function handleAvatarFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (file.size > MAX_IMAGE_SIZE) {
    toastController.create({
      message: t('contentEditor.imageTooLarge'),
      duration: 2500,
      position: 'top',
      color: 'warning',
    }).then(toast => toast.present())
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    updateField('avatar', reader.result as string)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function removeAvatar() {
  const updated = { ...model.value }
  delete updated.avatar
  model.value = updated
}

// --- Tachie ---
const showAddTachie = ref(false)
const newTachieName = ref('')
const newTachieDesc = ref('')
const tachieInputRef = ref<HTMLInputElement>()
const pendingTachieFile = ref<{ name: string, dataUri: string } | null>(null)

const tachieEntries = computed(() => {
  const tachies = model.value.tachies
  if (!tachies)
    return []
  return Object.entries(tachies).map(([name, tachie]) => ({ name, ...tachie }))
})

function triggerTachieUpload() {
  tachieInputRef.value?.click()
}

function handleTachieFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  if (file.size > MAX_IMAGE_SIZE) {
    toastController.create({
      message: t('contentEditor.imageTooLarge'),
      duration: 2500,
      position: 'top',
      color: 'warning',
    }).then(toast => toast.present())
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    pendingTachieFile.value = { name: file.name, dataUri: reader.result as string }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function addTachie() {
  const name = newTachieName.value.trim()
  if (!name || !pendingTachieFile.value)
    return
  const tachies = { ...(model.value.tachies || {}) }
  tachies[name] = {
    src: pendingTachieFile.value.dataUri,
    description: newTachieDesc.value.trim() || undefined,
  }
  updateField('tachies', tachies)
  newTachieName.value = ''
  newTachieDesc.value = ''
  pendingTachieFile.value = null
  showAddTachie.value = false
}

function removeTachie(name: string) {
  const tachies = { ...(model.value.tachies || {}) }
  delete tachies[name]
  const updated = { ...model.value }
  if (Object.keys(tachies).length > 0)
    updated.tachies = tachies
  else
    delete updated.tachies
  model.value = updated
}

// --- AI image ---
const canGenerateImage = computed(() => isImageGenerationAvailable(aiSettings.config))

async function handleAiImage(target: 'avatar' | 'tachie' = 'avatar') {
  const appearance = model.value.appearance || model.value.name || ''
  if (!appearance) {
    const toast = await toastController.create({
      message: t('contentEditor.fillAppearanceFirst'),
      duration: 2000,
      position: 'top',
      color: 'warning',
    })
    await toast.present()
    return
  }

  const prompt = `character portrait of ${model.value.name}: ${appearance}, anime style, high quality, detailed`

  if (canGenerateImage.value) {
    isGeneratingImage.value = true
    try {
      const result = await generateImage(
        {
          prompt,
          negativePrompt: 'low quality, blurry, deformed, ugly, watermark, text',
          width: target === 'avatar' ? 512 : 768,
          height: target === 'avatar' ? 512 : 1024,
        },
        aiSettings.config,
      )
      if (target === 'avatar') {
        updateField('avatar', result.url)
      }
      else {
        pendingTachieFile.value = { name: 'ai-generated.png', dataUri: result.url }
      }
      const toast = await toastController.create({
        message: t('contentEditor.imageGenerated'),
        duration: 1500,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      const toast = await toastController.create({
        message: `${t('contentEditor.imageGenerateFailed')}: ${msg}`,
        duration: 3000,
        position: 'top',
        color: 'danger',
      })
      await toast.present()
    }
    finally {
      isGeneratingImage.value = false
    }
  }
  else {
    const template = buildImagePromptTemplate(
      `character portrait of ${model.value.name}: ${appearance}`,
      'anime',
    )
    await navigator.clipboard.writeText(template.prompt)
    const toast = await toastController.create({
      message: t('contentEditor.imagePromptCopied'),
      duration: 1500,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
}
</script>

<template>
  <div class="cef">
    <!-- ═══ Hero: Avatar + Name ═══ -->
    <div class="cef-hero">
      <button class="cef-avatar" type="button" :aria-label="t('contentEditor.uploadAvatar')" @click="triggerAvatarUpload">
        <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" class="cef-avatar__img" alt="">
        <span v-else class="cef-avatar__initials">{{ avatarInitials }}</span>
        <!-- Loading overlay -->
        <Transition name="cef-fade">
          <div v-if="isGeneratingImage" class="cef-avatar__loading">
            <IonSpinner name="crescent" color="light" />
          </div>
        </Transition>
        <!-- Camera badge -->
        <div class="cef-avatar__badge">
          <IonIcon :icon="imageOutline" />
        </div>
      </button>

      <div class="cef-hero__actions">
        <IonButton fill="outline" size="small" class="cef-btn" @click="triggerAvatarUpload">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="imageOutline" />
          {{ t('contentEditor.uploadAvatar') }}
        </IonButton>
        <IonButton fill="outline" size="small" class="cef-btn cef-btn--ai" :disabled="isGeneratingImage" @click="handleAiImage('avatar')">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="sparklesOutline" />
          {{ isGeneratingImage ? t('contentEditor.generating') : (canGenerateImage ? t('contentEditor.aiGenerateImage') : t('contentEditor.aiImagePrompt')) }}
        </IonButton>
        <IonButton v-if="model.avatar" fill="clear" size="small" color="danger" class="cef-btn--remove" :aria-label="t('common.delete')" @click="removeAvatar">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="icon-only" :icon="closeCircleOutline" />
        </IonButton>
      </div>
      <input ref="avatarInputRef" type="file" accept="image/*" hidden @change="handleAvatarFile">
    </div>

    <!-- ═══ Section: Identity ═══ -->
    <div class="cef-section">
      <IonListHeader class="cef-section__header">
        <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
      </IonListHeader>
      <IonList class="cef-list">
        <IonItem>
          <IonInput
            :value="model.id"
            :label="t('contentEditor.characterId')"
            label-placement="stacked"
            :placeholder="t('contentEditor.characterIdPlaceholder')"
            :helper-text="t('contentEditor.characterIdHelper')"
            @ion-input="updateField('id', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonInput
            :value="model.name"
            :label="t('contentEditor.characterName')"
            label-placement="stacked"
            :placeholder="t('contentEditor.characterNamePlaceholder')"
            @ion-input="updateField('name', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <div class="cef-field">
            <IonLabel position="stacked">
              {{ t('contentEditor.aliases') }}
            </IonLabel>
            <TagsInput
              :model-value="model.aliases || []"
              :placeholder="t('contentEditor.aliasesPlaceholder')"
              @update:model-value="updateField('aliases', $event)"
            />
          </div>
        </IonItem>
        <IonItem>
          <IonInput
            :value="model.faction || ''"
            :label="t('contentEditor.faction')"
            label-placement="stacked"
            :placeholder="t('contentEditor.factionPlaceholder')"
            @ion-input="updateField('faction', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <div class="cef-field">
            <IonLabel position="stacked">
              {{ t('contentEditor.tags') }}
            </IonLabel>
            <TagsInput
              :model-value="model.tags || []"
              :placeholder="t('contentEditor.tagsPlaceholder')"
              @update:model-value="updateField('tags', $event)"
            />
          </div>
        </IonItem>
        <IonItem>
          <IonSelect
            :value="model.language || ''"
            :label="t('contentEditor.language')"
            label-placement="stacked"
            interface="popover"
            :placeholder="t('contentEditor.languageAuto')"
            @ion-change="updateField('language', ($event.detail.value || undefined) as any)"
          >
            <IonSelectOption value="">
              {{ t('contentEditor.languageAuto') }}
            </IonSelectOption>
            <IonSelectOption value="zh">
              中文
            </IonSelectOption>
            <IonSelectOption value="en">
              English
            </IonSelectOption>
            <IonSelectOption value="ja">
              日本語
            </IonSelectOption>
          </IonSelect>
        </IonItem>
      </IonList>
    </div>

    <!-- ═══ Section: Descriptions ═══ -->
    <div class="cef-section">
      <IonListHeader class="cef-section__header">
        <IonLabel>{{ t('contentEditor.description') }}</IonLabel>
      </IonListHeader>
      <IonList class="cef-list">
        <IonItem>
          <IonTextarea
            :value="model.appearance || ''"
            :label="t('contentEditor.appearance')"
            label-placement="stacked"
            :placeholder="t('contentEditor.appearancePlaceholder')"
            :auto-grow="true"
            :rows="3"
            @ion-input="updateField('appearance', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            :value="model.personality || ''"
            :label="t('contentEditor.personality')"
            label-placement="stacked"
            :placeholder="t('contentEditor.personalityPlaceholder')"
            :auto-grow="true"
            :rows="3"
            @ion-input="updateField('personality', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            :value="model.background || ''"
            :label="t('contentEditor.background')"
            label-placement="stacked"
            :placeholder="t('contentEditor.backgroundPlaceholder')"
            :auto-grow="true"
            :rows="3"
            @ion-input="updateField('background', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            :value="model.concept || ''"
            :label="t('contentEditor.concept')"
            label-placement="stacked"
            :placeholder="t('contentEditor.conceptPlaceholder')"
            :auto-grow="true"
            :rows="2"
            @ion-input="updateField('concept', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            :value="model.speechStyle || ''"
            :label="t('contentEditor.speechStyle')"
            label-placement="stacked"
            :placeholder="t('contentEditor.speechStylePlaceholder')"
            :auto-grow="true"
            :rows="2"
            @ion-input="updateField('speechStyle', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonInput
            :value="model.knowledgeDomain || ''"
            :label="t('contentEditor.knowledgeDomain')"
            label-placement="stacked"
            :placeholder="t('contentEditor.knowledgeDomainPlaceholder')"
            @ion-input="updateField('knowledgeDomain', ($event.detail.value ?? ''))"
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            :value="model.expertisePrompt || ''"
            :label="t('contentEditor.expertisePrompt')"
            label-placement="stacked"
            :placeholder="t('contentEditor.expertisePromptPlaceholder')"
            :auto-grow="true"
            :rows="3"
            @ion-input="updateField('expertisePrompt', ($event.detail.value ?? ''))"
          />
        </IonItem>
      </IonList>
    </div>

    <!-- ═══ Section: Sprites / Tachies ═══ -->
    <div class="cef-section">
      <IonListHeader class="cef-section__header">
        <IonLabel>{{ t('contentEditor.tachies') }}</IonLabel>
        <IonButton fill="clear" size="small" :aria-label="t('contentEditor.addTachie')" @click="showAddTachie = !showAddTachie">
          <IonIcon :icon="addOutline" />
        </IonButton>
      </IonListHeader>

      <!-- Tachie grid -->
      <TransitionGroup v-if="tachieEntries.length" name="cef-card" tag="div" class="cef-tachie-grid">
        <div v-for="tachie in tachieEntries" :key="tachie.name" class="cef-tachie">
          <div class="cef-tachie__preview">
            <img
              v-if="tachie.src.startsWith('data:') || tachie.src.startsWith('http') || tachie.src.startsWith('blob:')"
              :src="tachie.src"
              :alt="tachie.name"
              loading="lazy"
            >
            <IonIcon v-else :icon="imageOutline" class="cef-tachie__placeholder-icon" />
          </div>
          <div class="cef-tachie__meta">
            <span class="cef-tachie__name">{{ tachie.name }}</span>
            <span v-if="tachie.description" class="cef-tachie__desc">{{ tachie.description }}</span>
          </div>
          <button type="button" class="cef-tachie__delete" :aria-label="`Delete ${tachie.name}`" @click="removeTachie(tachie.name)">
            <IonIcon :icon="trashOutline" />
          </button>
        </div>
      </TransitionGroup>

      <!-- Empty state -->
      <div v-else class="cef-tachie-empty">
        <IonIcon :icon="imageOutline" class="cef-tachie-empty__icon" />
        <IonNote>{{ t('contentEditor.noTachies') }}</IonNote>
      </div>

      <!-- Add tachie panel (animated) -->
      <Transition name="cef-slide">
        <div v-if="showAddTachie" class="cef-tachie-add">
          <IonList class="cef-list">
            <IonItem>
              <IonInput
                v-model="newTachieName"
                :label="t('contentEditor.tachieName')"
                label-placement="stacked"
                :placeholder="t('contentEditor.tachieNamePlaceholder')"
              />
            </IonItem>
            <IonItem>
              <IonInput
                v-model="newTachieDesc"
                :label="t('contentEditor.tachieDesc')"
                label-placement="stacked"
                :placeholder="t('contentEditor.tachieDescPlaceholder')"
              />
            </IonItem>
          </IonList>

          <!-- Preview of pending image -->
          <div v-if="pendingTachieFile" class="cef-tachie-add__preview">
            <img :src="pendingTachieFile.dataUri" :alt="pendingTachieFile.name">
          </div>

          <div class="cef-tachie-add__bar">
            <IonButton fill="outline" size="small" class="cef-btn" @click="triggerTachieUpload">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon slot="start" :icon="imageOutline" />
              {{ pendingTachieFile ? pendingTachieFile.name : t('contentEditor.selectImage') }}
            </IonButton>
            <IonButton v-if="canGenerateImage" fill="outline" size="small" class="cef-btn cef-btn--ai" :disabled="isGeneratingImage" @click="handleAiImage('tachie')">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon slot="start" :icon="sparklesOutline" />
              {{ isGeneratingImage ? t('contentEditor.generating') : t('contentEditor.aiGenerateImage') }}
            </IonButton>
            <IonButton fill="solid" size="small" :disabled="!newTachieName.trim() || !pendingTachieFile" @click="addTachie">
              <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
              <IonIcon slot="start" :icon="addOutline" />
              {{ t('contentEditor.addTachie') }}
            </IonButton>
          </div>
          <input ref="tachieInputRef" type="file" accept="image/*" hidden @change="handleTachieFile">
        </div>
      </Transition>
    </div>

    <!-- ═══ Section: Relationships ═══ -->
    <div class="cef-section">
      <IonListHeader class="cef-section__header">
        <IonLabel>{{ t('contentEditor.relationships') }}</IonLabel>
      </IonListHeader>
      <div class="cef-relationships">
        <RelationshipEditor
          :model-value="model.relationships || []"
          :characters="characters"
          :current-character-id="model.id"
          @update:model-value="updateField('relationships', $event as AdvCharacterRelationship[])"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.cef {
  padding-bottom: env(safe-area-inset-bottom, var(--adv-space-lg));
}

.cef-section {
  margin-bottom: var(--adv-space-sm);
}

.cef-section__header {
  --color: var(--adv-text-primary);
  font-weight: 700;
  font-size: var(--adv-font-body-sm);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.cef-list {
  --ion-item-background: transparent;
}

.cef-field {
  width: 100%;
  padding: var(--adv-space-sm) 0;
}

.cef-relationships {
  padding: 0 var(--adv-space-md);
}

/* ── Buttons ── */
.cef-btn {
  --border-radius: var(--adv-radius-md);
  text-transform: none;
  font-weight: 500;
  min-height: 36px;
}

.cef-btn--ai {
  --color: #8b5cf6;
  --border-color: rgba(139, 92, 246, 0.3);
}

.cef-btn--remove {
  min-width: 44px;
  min-height: 44px;
}

/* ── Hero: Avatar + Actions ── */
.cef-hero {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  padding: var(--adv-space-lg) var(--adv-space-md);
  background: var(--adv-gradient-surface, linear-gradient(to bottom, var(--adv-surface-card), transparent));
  border-bottom: 1px solid var(--adv-border-subtle);
}

.cef-avatar {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  border: 3px solid var(--adv-border-subtle);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  padding: 0;
  outline: none;
}

.cef-avatar:focus-visible {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
}

.cef-avatar:active {
  transform: scale(0.96);
}

.cef-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cef-avatar__initials {
  font-size: 28px;
  font-weight: 800;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: -0.02em;
}

.cef-avatar__badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: 2px solid var(--ion-background-color, #fff);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.cef-avatar__loading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.cef-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

/* ── Tachie Grid ── */
.cef-tachie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--adv-space-sm);
  padding: var(--adv-space-xs) var(--adv-space-md);
}

.cef-tachie {
  position: relative;
  border-radius: var(--adv-radius-lg);
  border: 1px solid var(--adv-border-subtle);
  overflow: hidden;
  background: var(--adv-surface-card);
  transition:
    box-shadow 0.2s ease,
    transform 0.15s ease;
}

.cef-tachie:active {
  transform: scale(0.97);
}

.cef-tachie__preview {
  width: 100%;
  aspect-ratio: 3 / 4;
  background: var(--adv-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cef-tachie__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cef-tachie__placeholder-icon {
  font-size: 28px;
  color: var(--adv-text-tertiary);
  opacity: 0.5;
}

.cef-tachie__meta {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cef-tachie__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--adv-text-primary);
  line-height: 1.3;
}

.cef-tachie__desc {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 44×44 touch target */
.cef-tachie__delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 18px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.cef-tachie:hover .cef-tachie__delete,
.cef-tachie:focus-within .cef-tachie__delete {
  opacity: 1;
}

/* Always show on touch devices */
@media (hover: none) {
  .cef-tachie__delete {
    opacity: 0.8;
  }
}

/* Tachie empty state */
.cef-tachie-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-xl) var(--adv-space-md);
  color: var(--adv-text-tertiary);
}

.cef-tachie-empty__icon {
  font-size: 40px;
  opacity: 0.3;
}

/* Add tachie panel */
.cef-tachie-add {
  margin: var(--adv-space-sm) var(--adv-space-md);
  border: 2px dashed var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  padding: var(--adv-space-sm);
  background: var(--adv-surface-card);
}

.cef-tachie-add__preview {
  width: 80px;
  height: 107px;
  border-radius: var(--adv-radius-md);
  overflow: hidden;
  margin: var(--adv-space-sm) auto;
  border: 1px solid var(--adv-border-subtle);
}

.cef-tachie-add__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cef-tachie-add__bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  padding-top: var(--adv-space-sm);
}

/* ── Transitions ── */
.cef-fade-enter-active,
.cef-fade-leave-active {
  transition: opacity 0.2s ease;
}
.cef-fade-enter-from,
.cef-fade-leave-to {
  opacity: 0;
}

.cef-slide-enter-active {
  transition: all 0.25s ease-out;
}
.cef-slide-leave-active {
  transition: all 0.2s ease-in;
}
.cef-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}
.cef-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.cef-card-enter-active {
  transition: all 0.25s ease-out;
}
.cef-card-leave-active {
  transition: all 0.2s ease-in;
  position: absolute;
}
.cef-card-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.cef-card-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.cef-card-move {
  transition: transform 0.25s ease;
}

/* ── Responsive ── */
@media (max-width: 375px) {
  .cef-hero {
    flex-direction: column;
    text-align: center;
  }

  .cef-hero__actions {
    justify-content: center;
  }

  .cef-tachie-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .cef-avatar,
  .cef-tachie,
  .cef-tachie__delete {
    transition: none;
  }

  .cef-fade-enter-active,
  .cef-fade-leave-active,
  .cef-slide-enter-active,
  .cef-slide-leave-active,
  .cef-card-enter-active,
  .cef-card-leave-active,
  .cef-card-move {
    transition: none;
  }
}
</style>
