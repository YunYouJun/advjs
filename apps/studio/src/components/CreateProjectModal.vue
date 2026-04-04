<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { bookOutline, closeOutline, createOutline } from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SLUG_RE, toSlug } from '../utils/slug'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create', payload: { displayName: string, slug: string, templateId: string }): void
}>()

const { t } = useI18n()

interface ProjectTemplate {
  id: string
  icon: string
  titleKey: string
  descKey: string
}

const templates: ProjectTemplate[] = [
  {
    id: 'visual-novel-starter',
    icon: bookOutline,
    titleKey: 'projects.templateStarterTitle',
    descKey: 'projects.templateStarterDesc',
  },
]

const selectedTemplate = ref(templates[0].id)
const displayName = ref('')
const slugManuallyEdited = ref(false)
const slugValue = ref('')

// Auto-generate slug from display name (unless user manually edited it)
watch(displayName, (name) => {
  if (!slugManuallyEdited.value) {
    slugValue.value = toSlug(name)
  }
})

function onSlugInput(value: string) {
  slugManuallyEdited.value = true
  slugValue.value = value
}

// Validation — display name
const nameError = computed(() => {
  if (!displayName.value.trim())
    return t('projects.nameRequired')
  return ''
})

// Validation — slug (filesystem/URL safe)
const slugError = computed(() => {
  const s = slugValue.value.trim()
  if (!s)
    return t('projects.slugRequired')
  if (!SLUG_RE.test(s))
    return t('projects.slugInvalid')
  return ''
})

const canCreate = computed(() => !nameError.value && !slugError.value && !!selectedTemplate.value)

// Reset state when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    displayName.value = ''
    slugValue.value = ''
    slugManuallyEdited.value = false
    selectedTemplate.value = templates[0].id
  }
})

function handleCreate() {
  if (!canCreate.value)
    return
  emit('create', {
    displayName: displayName.value.trim(),
    slug: slugValue.value.trim(),
    templateId: selectedTemplate.value,
  })
}
</script>

<template>
  <IonModal
    :is-open="open"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    @did-dismiss="emit('close')"
  >
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton @click="emit('close')">
            <IonIcon :icon="closeOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>{{ t('projects.createProject') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="create-modal">
        <!-- Template Selection -->
        <section class="create-modal__section">
          <h3 class="create-modal__label">
            {{ t('projects.chooseTemplate') }}
          </h3>
          <div class="create-modal__templates">
            <button
              v-for="tpl in templates"
              :key="tpl.id"
              class="template-card"
              :class="{ 'template-card--selected': selectedTemplate === tpl.id }"
              @click="selectedTemplate = tpl.id"
            >
              <span class="template-card__check">
                <span v-if="selectedTemplate === tpl.id" class="template-card__check-dot" />
              </span>
              <span class="template-card__icon">
                <IonIcon :icon="tpl.icon" />
              </span>
              <span class="template-card__text">
                <strong>{{ t(tpl.titleKey) }}</strong>
                <span>{{ t(tpl.descKey) }}</span>
              </span>
            </button>
          </div>
        </section>

        <!-- Display Name -->
        <section class="create-modal__section">
          <h3 class="create-modal__label">
            {{ t('projects.projectName') }}
          </h3>
          <IonInput
            v-model="displayName"
            :placeholder="t('projects.projectNamePlaceholder')"
            class="create-modal__input"
            fill="outline"
            @keyup.enter="handleCreate"
          />
          <p v-if="displayName.trim() && nameError" class="create-modal__error">
            {{ nameError }}
          </p>
          <p v-else class="create-modal__hint">
            {{ t('projects.nameHint') }}
          </p>
        </section>

        <!-- Slug (folder name / COS path) -->
        <section class="create-modal__section">
          <h3 class="create-modal__label">
            {{ t('projects.projectSlug') }}
          </h3>
          <IonInput
            :value="slugValue"
            :placeholder="t('projects.slugPlaceholder')"
            class="create-modal__input"
            :class="{ 'create-modal__input--error': slugValue.trim() && slugError }"
            fill="outline"
            @ion-input="onSlugInput(($event.detail.value as string) ?? '')"
            @keyup.enter="handleCreate"
          />
          <p v-if="slugValue.trim() && slugError" class="create-modal__error">
            {{ slugError }}
          </p>
          <p v-else class="create-modal__hint">
            {{ t('projects.slugHint') }}
          </p>
        </section>

        <!-- Create Button -->
        <IonButton
          expand="block"
          class="create-modal__submit"
          :disabled="!canCreate"
          @click="handleCreate"
        >
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="createOutline" />
          {{ t('projects.createProject') }}
        </IonButton>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.create-modal {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-lg, 24px);
  padding-bottom: var(--adv-space-lg, 24px);
}

.create-modal__section {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
}

.create-modal__label {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--adv-text-secondary, var(--ion-color-medium));
  margin: 0;
}

/* Template cards */
.create-modal__templates {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
}

.template-card {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md, 16px);
  padding: var(--adv-space-md, 16px);
  border-radius: var(--adv-radius-lg, 12px);
  border: 2px solid var(--adv-border-subtle, rgba(150, 150, 150, 0.2));
  background: var(--adv-surface-card, var(--ion-card-background));
  cursor: pointer;
  text-align: left;
  transition:
    border-color 200ms ease,
    box-shadow 200ms ease,
    background-color 200ms ease;
  -webkit-tap-highlight-color: transparent;
}

.template-card:active {
  transform: scale(0.98);
}

.template-card--selected {
  border-color: var(--ion-color-primary);
  background: var(--adv-surface-card, var(--ion-card-background));
  box-shadow:
    0 0 0 1px var(--ion-color-primary),
    0 2px 12px rgba(99, 102, 241, 0.15);
}

.template-card__check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--adv-border-subtle, rgba(150, 150, 150, 0.35));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 200ms ease;
}

.template-card--selected .template-card__check {
  border-color: var(--ion-color-primary);
}

.template-card__check-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ion-color-primary);
}

.template-card__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--adv-radius-md, 8px);
  background: rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-size: 22px;
  transition: background-color 200ms ease;
}

.template-card--selected .template-card__icon {
  background: rgba(99, 102, 241, 0.18);
}

.template-card__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.template-card__text strong {
  font-size: var(--adv-font-body, 15px);
  font-weight: 600;
  color: var(--adv-text-primary, var(--ion-text-color));
}

.template-card__text span {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary, var(--ion-color-medium));
}

/* Input */
.create-modal__input {
  --border-radius: var(--adv-radius-md, 8px);
}

.create-modal__input--error {
  --border-color: var(--ion-color-danger);
}

.create-modal__error {
  font-size: var(--adv-font-caption, 12px);
  color: var(--ion-color-danger);
  margin: 0;
}

.create-modal__hint {
  font-size: var(--adv-font-caption, 12px);
  color: var(--adv-text-secondary, var(--ion-color-medium));
  margin: 0;
}

/* Submit */
.create-modal__submit {
  margin-top: var(--adv-space-sm, 8px);
  --border-radius: var(--adv-radius-lg, 12px);
  min-height: 48px;
  font-weight: 600;
}
</style>
