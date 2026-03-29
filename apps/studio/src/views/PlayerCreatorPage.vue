<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  arrowForwardOutline,
  chevronDownOutline,
  chevronUpOutline,
  refreshOutline,
  sparklesOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CharacterEditorForm from '../components/CharacterEditorForm.vue'
import { usePlayerCreator } from '../composables/usePlayerCreator'
import { useViewModeStore } from '../stores/useViewModeStore'
import '../styles/player-creator.css'

const { t, locale } = useI18n()
const router = useRouter()
const viewModeStore = useViewModeStore()

const {
  isGenerating,
  generatedCharacter,
  rawMarkdown,
  error,
  isGeneratingAvatar,
  generate,
  stop,
  reset,
  generateAvatar,
  isAiConfigured,
} = usePlayerCreator()

// Wizard state
const step = ref<1 | 2 | 3>(1)
const description = ref('')
const showEditForm = ref(false)

// The editable character (copy of generatedCharacter for v-model)
const editableCharacter = ref<AdvCharacter>({
  id: '',
  name: '',
})

const lang = computed(() => locale.value)

const suggestions = computed(() => [
  { key: 'suggestion1', label: t('world.suggestion1') },
  { key: 'suggestion2', label: t('world.suggestion2') },
  { key: 'suggestion3', label: t('world.suggestion3') },
  { key: 'suggestion4', label: t('world.suggestion4') },
  { key: 'suggestion5', label: t('world.suggestion5') },
])

function applySuggestion(label: string) {
  description.value = label
}

async function handleGenerate() {
  if (!description.value.trim())
    return

  await generate(description.value.trim(), lang.value)

  if (generatedCharacter.value) {
    editableCharacter.value = { ...generatedCharacter.value }
    step.value = 2
  }
}

function handleRegenerate() {
  reset()
  step.value = 1
  showEditForm.value = false
}

async function handleGenerateAvatar() {
  try {
    const result = await generateAvatar(editableCharacter.value)
    if (result.url) {
      editableCharacter.value = { ...editableCharacter.value, avatar: result.url }
      const toast = await toastController.create({
        message: t('contentEditor.imageGenerated'),
        duration: 1500,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
    else if (result.promptCopied) {
      const toast = await toastController.create({
        message: t('contentEditor.imagePromptCopied'),
        duration: 1500,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
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
}

async function handleSaveAndPlay() {
  const char = editableCharacter.value
  if (!char.id || !char.name) {
    const toast = await toastController.create({
      message: t('contentEditor.validationError', { errors: 'ID, Name' }),
      duration: 2000,
      position: 'top',
      color: 'warning',
    })
    await toast.present()
    return
  }

  viewModeStore.addCustomCharacter({ ...char })
  viewModeStore.setPlayerCharacter(char.id)
  viewModeStore.setMode('character')
  step.value = 3
}

function goToWorld() {
  router.replace('/tabs/world')
}

function goToSettings() {
  router.push('/tabs/me/settings/ai')
}

function getInitials(name: string): string {
  return name ? name.slice(0, 2) : '?'
}

const avatarUrl = computed(() => {
  const avatar = editableCharacter.value.avatar
  if (!avatar)
    return ''
  if (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('blob:'))
    return avatar
  return ''
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/world" />
        </IonButtons>
        <IonTitle>{{ t('world.playerCreator') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="pc-page">
        <!-- Step indicator -->
        <div class="pc-steps">
          <div class="pc-step" :class="{ 'pc-step--active': step === 1, 'pc-step--done': step > 1 }">
            <span class="pc-step__dot">{{ step > 1 ? '✓' : '1' }}</span>
          </div>
          <div class="pc-step__line" :class="{ 'pc-step__line--active': step > 1 }" />
          <div class="pc-step" :class="{ 'pc-step--active': step === 2, 'pc-step--done': step > 2 }">
            <span class="pc-step__dot">{{ step > 2 ? '✓' : '2' }}</span>
          </div>
          <div class="pc-step__line" :class="{ 'pc-step__line--active': step > 2 }" />
          <div class="pc-step" :class="{ 'pc-step--active': step === 3 }">
            <span class="pc-step__dot">3</span>
          </div>
        </div>

        <!-- ═══ Step 1: Describe ═══ -->
        <Transition name="pc-fade" mode="out-in">
          <div v-if="step === 1" key="step1">
            <div class="pc-input-section">
              <div class="pc-input-section__label">
                {{ t('world.playerCreatorDesc') }}
              </div>
              <textarea
                v-model="description"
                class="pc-textarea"
                :placeholder="t('world.playerCreatorPlaceholder')"
                :disabled="isGenerating"
              />
            </div>

            <!-- Quick suggestions -->
            <div class="pc-suggestions">
              <div class="pc-suggestions__label">
                {{ t('world.quickSuggestion') }}
              </div>
              <div class="pc-suggestions__list">
                <button
                  v-for="s in suggestions"
                  :key="s.key"
                  class="pc-suggestion-tag"
                  :disabled="isGenerating"
                  @click="applySuggestion(s.label)"
                >
                  {{ s.label }}
                </button>
              </div>
            </div>

            <!-- AI not configured warning -->
            <div v-if="!isAiConfigured()" class="pc-warning">
              <span>{{ t('chat.aiNotConfigured') }}</span>
              <a href="#" @click.prevent="goToSettings">{{ t('chat.configureAi') }}</a>
            </div>

            <!-- Generating state -->
            <div v-if="isGenerating" class="pc-generating">
              <IonSpinner name="crescent" color="primary" />
              <div class="pc-generating__text">
                {{ t('world.playerCreatorGenerating') }}
              </div>
              <div v-if="rawMarkdown" class="pc-raw-output">
                {{ rawMarkdown }}
              </div>
            </div>

            <!-- Error -->
            <div v-if="error" class="pc-error">
              {{ t('world.playerCreatorError') }}
              <br>
              <small>{{ error }}</small>
            </div>

            <!-- Actions -->
            <div class="pc-actions">
              <IonButton
                v-if="isGenerating"
                fill="outline"
                color="medium"
                @click="stop"
              >
                {{ t('contentEditor.aiStop') }}
              </IonButton>
              <IonButton
                v-else
                :disabled="!description.trim() || !isAiConfigured()"
                @click="handleGenerate"
              >
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="start" :icon="sparklesOutline" />
                {{ t('world.playerCreatorGenerate') }}
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="end" :icon="arrowForwardOutline" />
              </IonButton>
            </div>
          </div>
        </Transition>

        <!-- ═══ Step 2: Preview & Edit ═══ -->
        <Transition name="pc-fade" mode="out-in">
          <div v-if="step === 2" key="step2">
            <div class="pc-preview">
              <!-- Character card -->
              <div class="pc-card">
                <div class="pc-card__avatar">
                  <img v-if="avatarUrl" :src="avatarUrl" alt="">
                  <span v-else class="pc-card__initials">{{ getInitials(editableCharacter.name) }}</span>
                </div>
                <div class="pc-card__info">
                  <div class="pc-card__name">
                    {{ editableCharacter.name || '?' }}
                  </div>
                  <div class="pc-card__meta">
                    <template v-if="editableCharacter.personality">
                      <span class="pc-card__meta-label">{{ t('contentEditor.personality') }}:</span>
                      {{ editableCharacter.personality.slice(0, 100) }}{{ editableCharacter.personality.length > 100 ? '...' : '' }}
                    </template>
                    <br v-if="editableCharacter.personality && editableCharacter.background">
                    <template v-if="editableCharacter.background">
                      <span class="pc-card__meta-label">{{ t('contentEditor.background') }}:</span>
                      {{ editableCharacter.background.slice(0, 100) }}{{ editableCharacter.background.length > 100 ? '...' : '' }}
                    </template>
                  </div>
                </div>
              </div>

              <!-- Edit toggle -->
              <div class="pc-edit-toggle">
                <IonButton fill="clear" size="small" @click="showEditForm = !showEditForm">
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="start" :icon="showEditForm ? chevronUpOutline : chevronDownOutline" />
                  {{ showEditForm ? t('world.playerCreatorCollapseEdit') : t('world.playerCreatorExpandEdit') }}
                </IonButton>
              </div>

              <!-- Editable form -->
              <Transition name="pc-fade">
                <div v-if="showEditForm" class="pc-edit-form">
                  <CharacterEditorForm v-model="editableCharacter" />
                </div>
              </Transition>

              <!-- Actions -->
              <div class="pc-preview-actions">
                <IonButton fill="outline" size="small" :disabled="isGeneratingAvatar" @click="handleGenerateAvatar">
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="start" :icon="sparklesOutline" />
                  {{ isGeneratingAvatar ? t('contentEditor.generating') : t('world.generateAvatar') }}
                </IonButton>
                <IonButton fill="outline" color="medium" size="small" @click="handleRegenerate">
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="start" :icon="refreshOutline" />
                  {{ t('world.playerCreatorRegenerate') }}
                </IonButton>
              </div>

              <div class="pc-actions">
                <IonButton
                  :disabled="!editableCharacter.id || !editableCharacter.name"
                  @click="handleSaveAndPlay"
                >
                  {{ t('world.playerCreatorSave') }}
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="end" :icon="arrowForwardOutline" />
                </IonButton>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ═══ Step 3: Success ═══ -->
        <Transition name="pc-fade" mode="out-in">
          <div v-if="step === 3" key="step3">
            <div class="pc-success">
              <div class="pc-success__icon">
                ✅
              </div>
              <div class="pc-success__title">
                {{ t('world.playerCreatorSuccess') }}
              </div>
              <div class="pc-success__desc">
                {{ t('world.playerCreatorSetActive') }}
              </div>
              <IonButton @click="goToWorld">
                {{ t('world.playerCreatorGoWorld') }}
                <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                <IonIcon slot="end" :icon="arrowForwardOutline" />
              </IonButton>
            </div>
          </div>
        </Transition>
      </div>
    </IonContent>
  </IonPage>
</template>
