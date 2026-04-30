<script setup lang="ts">
/**
 * Optional structured attributes panel for characters.
 *
 * Edits the `attributes.*` subtree on `AdvCharacter`, which is persisted into
 * the YAML frontmatter of the character's `.character.md` file.
 *
 * Design notes:
 * - The whole panel is opt-in: if the user never enables it, the character
 *   file stays visually identical to before.
 * - Template selection (universal / galgame / rpg) controls which groups of
 *   fields are rendered; a user can opt into multiple templates by keeping
 *   data on legacy fields.
 * - Runtime state (current affinity, HP, etc.) does NOT belong here — it
 *   goes into `useCharacterStateStore` via `AdvCharacter.dynamicState`.
 */
import type {
  AdvCharacter,
  AdvCharacterAttributes,
  AdvCharacterCustomField,
  AdvCharacterGalgameAttrs,
  AdvCharacterProfile,
  AdvCharacterRpgAttrs,
  AdvCharacterRpgStats,
  AdvCharacterTemplate,
} from '@advjs/types'
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/vue'
import { addOutline, optionsOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TagsInput from './TagsInput.vue'

/** Characters not allowed in a custom field key (anything non-word and not `-`). */
const RE_NON_KEY = /[^\w-]+/g
/** Leading / trailing underscores to strip after sanitization. */
const RE_WRAP_UNDERSCORE = /^_+|_+$/g

const { t } = useI18n()

const model = defineModel<AdvCharacter>({ required: true })

/** Whether the panel is enabled (i.e. we've initialized `attributes`). */
const enabled = computed({
  get: () => model.value.attributes !== undefined,
  set: (value) => {
    if (value && !model.value.attributes) {
      model.value = { ...model.value, attributes: { template: 'universal' } }
    }
    else if (!value && model.value.attributes) {
      const next = { ...model.value }
      delete next.attributes
      model.value = next
    }
  },
})

const attrs = computed<AdvCharacterAttributes>(() => model.value.attributes ?? {})

/** Helper: partially update `attributes` and propagate to the parent model. */
function patchAttrs(patch: Partial<AdvCharacterAttributes>) {
  model.value = {
    ...model.value,
    attributes: { ...attrs.value, ...patch },
  }
}

/** Helper: update a nested subtree (e.g. `profile`, `galgame.stats`). */
function patchProfile(patch: Partial<AdvCharacterProfile>) {
  patchAttrs({ profile: { ...(attrs.value.profile ?? {}), ...patch } })
}
function patchGalgame(patch: Partial<AdvCharacterGalgameAttrs>) {
  patchAttrs({ galgame: { ...(attrs.value.galgame ?? {}), ...patch } })
}
function patchRpg(patch: Partial<AdvCharacterRpgAttrs>) {
  patchAttrs({ rpg: { ...(attrs.value.rpg ?? {}), ...patch } })
}
function patchStats(patch: Partial<AdvCharacterRpgStats>) {
  const rpg = attrs.value.rpg ?? {}
  patchRpg({ stats: { ...(rpg.stats ?? {}), ...patch } })
}

const template = computed<AdvCharacterTemplate>(() => attrs.value.template ?? 'universal')

function setTemplate(next: AdvCharacterTemplate) {
  patchAttrs({ template: next })
}

/** Ion input -> `number | undefined`, treating empty string as "not set". */
function numberFromInput(raw: string | number | null | undefined): number | undefined {
  if (raw === '' || raw === null || raw === undefined)
    return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Ion input -> `string | undefined`, treating empty string as "not set". */
function stringFromInput(raw: string | number | null | undefined): string | undefined {
  if (raw === '' || raw === null || raw === undefined)
    return undefined
  return String(raw)
}

/** Two-way string binding helpers so template stays tidy. */
const profileAge = computed({
  get: () => attrs.value.profile?.age ?? '',
  set: (v: string | number) => patchProfile({ age: typeof v === 'number' ? v : stringFromInput(v) }),
})

const promptInject = computed({
  get: () => attrs.value.ai?.promptInject ?? true,
  set: (v: boolean) => patchAttrs({ ai: { ...(attrs.value.ai ?? {}), promptInject: v } }),
})

// ─── Custom fields ───
// We store custom fields as a Record<string, AdvCharacterCustomField>, where
// the Record key is the stable identifier used in frontmatter and the value
// carries the display label + the actual data. The UI works on a flattened
// array view for easier list rendering.

type CustomValueType = 'string' | 'number' | 'tags'

/** Flattened, ordered view of custom fields for UI rendering. */
interface CustomEntry {
  key: string
  label: string
  value: string | number | string[]
  type: CustomValueType
}

const customEntries = computed<CustomEntry[]>(() => {
  const custom = attrs.value.custom
  if (!custom)
    return []
  return Object.entries(custom).map(([key, field]) => ({
    key,
    label: field.label,
    value: field.value,
    type: detectCustomType(field.value),
  }))
})

function detectCustomType(value: AdvCharacterCustomField['value']): CustomValueType {
  if (Array.isArray(value))
    return 'tags'
  if (typeof value === 'number')
    return 'number'
  return 'string'
}

/** Default empty value for a given value type. */
function defaultValueFor(type: CustomValueType): AdvCharacterCustomField['value'] {
  if (type === 'number')
    return 0
  if (type === 'tags')
    return []
  return ''
}

/**
 * Persist custom fields back to attributes.
 *
 * Takes a plain map (key → CustomField) and strips the whole `custom` subtree
 * when empty so we don't write `custom: {}` to YAML.
 */
function writeCustom(next: Record<string, AdvCharacterCustomField>) {
  if (Object.keys(next).length === 0) {
    const rest = { ...attrs.value }
    delete rest.custom
    model.value = { ...model.value, attributes: rest }
  }
  else {
    patchAttrs({ custom: next })
  }
}

/** Sanitize user-entered key: lower-case, digits, dashes, underscores only. */
function sanitizeCustomKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(RE_NON_KEY, '_')
    .replace(RE_WRAP_UNDERSCORE, '')
}

// Local state for the "add custom field" mini-form.
const newCustomLabel = ref('')
const newCustomType = ref<CustomValueType>('string')
const newCustomError = ref<string>('')

function addCustomField() {
  newCustomError.value = ''
  const label = newCustomLabel.value.trim()
  if (!label) {
    newCustomError.value = 'labelRequired'
    return
  }
  const baseKey = sanitizeCustomKey(label) || 'field'
  const existing = attrs.value.custom ?? {}
  // Ensure uniqueness by suffixing _2 / _3 / ... if needed.
  let key = baseKey
  let suffix = 2
  while (key in existing) {
    key = `${baseKey}_${suffix}`
    suffix++
  }
  writeCustom({
    ...existing,
    [key]: { label, value: defaultValueFor(newCustomType.value) },
  })
  newCustomLabel.value = ''
  newCustomType.value = 'string'
}

function removeCustomField(key: string) {
  const existing = attrs.value.custom ?? {}
  const { [key]: _removed, ...rest } = existing
  writeCustom(rest)
}

function updateCustomField(key: string, patch: Partial<AdvCharacterCustomField>) {
  const existing = attrs.value.custom ?? {}
  const current = existing[key]
  if (!current)
    return
  writeCustom({ ...existing, [key]: { ...current, ...patch } })
}

function updateCustomType(key: string, type: CustomValueType) {
  // Switching value type resets the value to the new type's empty default, to
  // avoid mismatched runtime values sneaking into the YAML.
  updateCustomField(key, { value: defaultValueFor(type) })
}
</script>

<template>
  <div class="cap">
    <!-- ═══ Section header + master toggle ═══ -->
    <div class="cap-header">
      <div class="cap-header__title">
        <IonIcon :icon="optionsOutline" />
        <span>{{ t('contentEditor.attributes.title') }}</span>
      </div>
      <IonToggle slot="end" v-model="enabled" />
    </div>
    <IonNote class="cap-note">
      {{ t('contentEditor.attributes.hint') }}
    </IonNote>

    <!-- Body only shown when enabled -->
    <div v-if="enabled" class="cap-body">
      <!-- ═══ Template selector ═══ -->
      <IonSegment
        :value="template"
        class="cap-segment"
        @ion-change="(e: any) => setTemplate(e.detail.value as AdvCharacterTemplate)"
      >
        <IonSegmentButton value="universal">
          <IonLabel>{{ t('contentEditor.attributes.templates.universal') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="galgame">
          <IonLabel>{{ t('contentEditor.attributes.templates.galgame') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="rpg">
          <IonLabel>{{ t('contentEditor.attributes.templates.rpg') }}</IonLabel>
        </IonSegmentButton>
      </IonSegment>

      <!-- ═══ Universal: profile.* ═══ -->
      <div class="cap-section">
        <IonListHeader class="cap-section__header">
          <IonLabel>{{ t('contentEditor.attributes.profile') }}</IonLabel>
        </IonListHeader>
        <IonList class="cap-list">
          <IonItem>
            <IonInput
              :value="profileAge"
              :label="t('contentEditor.attributes.age')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.agePlaceholder')"
              @ion-input="(e: any) => profileAge = e.detail.value ?? ''"
            />
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.profile?.gender ?? ''"
              :label="t('contentEditor.attributes.gender')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.genderPlaceholder')"
              @ion-input="(e: any) => patchProfile({ gender: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.profile?.occupation ?? ''"
              :label="t('contentEditor.attributes.occupation')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.occupationPlaceholder')"
              @ion-input="(e: any) => patchProfile({ occupation: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <div class="cap-field">
              <IonLabel position="stacked">
                {{ t('contentEditor.attributes.personalityTags') }}
              </IonLabel>
              <TagsInput
                :model-value="attrs.profile?.personalityTags ?? []"
                :placeholder="t('contentEditor.attributes.personalityTagsPlaceholder')"
                @update:model-value="(v) => patchProfile({ personalityTags: v.length ? v : undefined })"
              />
            </div>
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.profile?.appearanceSummary ?? ''"
              :label="t('contentEditor.attributes.appearanceSummary')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.appearanceSummaryPlaceholder')"
              @ion-input="(e: any) => patchProfile({ appearanceSummary: stringFromInput(e.detail.value) })"
            />
          </IonItem>
        </IonList>
      </div>

      <!-- ═══ Galgame: attributes.galgame.* ═══ -->
      <div v-if="template === 'galgame'" class="cap-section">
        <IonListHeader class="cap-section__header">
          <IonLabel>{{ t('contentEditor.attributes.galgame.heading') }}</IonLabel>
        </IonListHeader>
        <IonList class="cap-list">
          <IonItem>
            <IonInput
              :value="attrs.galgame?.birthday ?? ''"
              :label="t('contentEditor.attributes.galgame.birthday')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.galgame.birthdayPlaceholder')"
              @ion-input="(e: any) => patchGalgame({ birthday: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.galgame?.bloodType ?? ''"
              :label="t('contentEditor.attributes.galgame.bloodType')"
              label-placement="stacked"
              placeholder="A / B / AB / O"
              @ion-input="(e: any) => patchGalgame({ bloodType: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.galgame?.zodiac ?? ''"
              :label="t('contentEditor.attributes.galgame.zodiac')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.galgame.zodiacPlaceholder')"
              @ion-input="(e: any) => patchGalgame({ zodiac: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.galgame?.height ?? ''"
              :label="t('contentEditor.attributes.galgame.height')"
              label-placement="stacked"
              placeholder="160cm"
              @ion-input="(e: any) => patchGalgame({ height: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <div class="cap-field">
              <IonLabel position="stacked">
                {{ t('contentEditor.attributes.galgame.likes') }}
              </IonLabel>
              <TagsInput
                :model-value="attrs.galgame?.likes ?? []"
                @update:model-value="(v) => patchGalgame({ likes: v.length ? v : undefined })"
              />
            </div>
          </IonItem>
          <IonItem>
            <div class="cap-field">
              <IonLabel position="stacked">
                {{ t('contentEditor.attributes.galgame.dislikes') }}
              </IonLabel>
              <TagsInput
                :model-value="attrs.galgame?.dislikes ?? []"
                @update:model-value="(v) => patchGalgame({ dislikes: v.length ? v : undefined })"
              />
            </div>
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              :value="attrs.galgame?.affinityInitial ?? ''"
              :label="t('contentEditor.attributes.galgame.affinityInitial')"
              label-placement="stacked"
              :helper-text="t('contentEditor.attributes.galgame.affinityInitialHelper')"
              placeholder="0"
              @ion-input="(e: any) => patchGalgame({ affinityInitial: numberFromInput(e.detail.value) })"
            />
          </IonItem>
        </IonList>
      </div>

      <!-- ═══ RPG: attributes.rpg.* ═══ -->
      <div v-if="template === 'rpg'" class="cap-section">
        <IonListHeader class="cap-section__header">
          <IonLabel>{{ t('contentEditor.attributes.rpg.heading') }}</IonLabel>
        </IonListHeader>
        <IonList class="cap-list">
          <IonItem>
            <IonInput
              :value="attrs.rpg?.race ?? ''"
              :label="t('contentEditor.attributes.rpg.race')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.rpg.racePlaceholder')"
              @ion-input="(e: any) => patchRpg({ race: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.rpg?.class ?? ''"
              :label="t('contentEditor.attributes.rpg.class')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.rpg.classPlaceholder')"
              @ion-input="(e: any) => patchRpg({ class: stringFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              :value="attrs.rpg?.level ?? ''"
              :label="t('contentEditor.attributes.rpg.level')"
              label-placement="stacked"
              placeholder="1"
              @ion-input="(e: any) => patchRpg({ level: numberFromInput(e.detail.value) })"
            />
          </IonItem>
        </IonList>

        <!-- 6-dimensional stats grid -->
        <div class="cap-stats">
          <div v-for="stat in (['str', 'dex', 'int', 'con', 'wis', 'cha'] as const)" :key="stat" class="cap-stats__item">
            <IonLabel class="cap-stats__label">
              {{ t(`contentEditor.attributes.rpg.stats.${stat}`) }}
            </IonLabel>
            <IonInput
              class="cap-stats__input"
              type="number"
              :value="attrs.rpg?.stats?.[stat] ?? ''"
              placeholder="10"
              @ion-input="(e: any) => patchStats({ [stat]: numberFromInput(e.detail.value) })"
            />
          </div>
        </div>

        <IonList class="cap-list">
          <IonItem>
            <IonInput
              type="number"
              :value="attrs.rpg?.hpInitial ?? ''"
              :label="t('contentEditor.attributes.rpg.hpInitial')"
              label-placement="stacked"
              :helper-text="t('contentEditor.attributes.rpg.hpInitialHelper')"
              @ion-input="(e: any) => patchRpg({ hpInitial: numberFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              :value="attrs.rpg?.mpInitial ?? ''"
              :label="t('contentEditor.attributes.rpg.mpInitial')"
              label-placement="stacked"
              @ion-input="(e: any) => patchRpg({ mpInitial: numberFromInput(e.detail.value) })"
            />
          </IonItem>
          <IonItem>
            <div class="cap-field">
              <IonLabel position="stacked">
                {{ t('contentEditor.attributes.rpg.skills') }}
              </IonLabel>
              <TagsInput
                :model-value="attrs.rpg?.skills ?? []"
                @update:model-value="(v) => patchRpg({ skills: v.length ? v : undefined })"
              />
            </div>
          </IonItem>
          <IonItem>
            <div class="cap-field">
              <IonLabel position="stacked">
                {{ t('contentEditor.attributes.rpg.equipment') }}
              </IonLabel>
              <TagsInput
                :model-value="attrs.rpg?.equipment ?? []"
                @update:model-value="(v) => patchRpg({ equipment: v.length ? v : undefined })"
              />
            </div>
          </IonItem>
          <IonItem>
            <IonInput
              :value="attrs.rpg?.alignment ?? ''"
              :label="t('contentEditor.attributes.rpg.alignment')"
              label-placement="stacked"
              :placeholder="t('contentEditor.attributes.rpg.alignmentPlaceholder')"
              @ion-input="(e: any) => patchRpg({ alignment: stringFromInput(e.detail.value) })"
            />
          </IonItem>
        </IonList>
      </div>

      <!-- ═══ Custom: attributes.custom.* ═══ -->
      <div class="cap-section">
        <IonListHeader class="cap-section__header">
          <IonLabel>{{ t('contentEditor.attributes.custom.heading') }}</IonLabel>
        </IonListHeader>
        <IonNote class="cap-note cap-note--sub">
          {{ t('contentEditor.attributes.custom.hint') }}
        </IonNote>

        <!-- Existing custom fields -->
        <IonList v-if="customEntries.length" class="cap-list">
          <IonItem v-for="entry in customEntries" :key="entry.key" class="cap-custom-item">
            <div class="cap-custom">
              <div class="cap-custom__row cap-custom__row--head">
                <IonInput
                  :value="entry.label"
                  :label="t('contentEditor.attributes.custom.label')"
                  label-placement="stacked"
                  @ion-input="(e: any) => updateCustomField(entry.key, { label: (e.detail.value ?? '').trim() })"
                />
                <IonSelect
                  :value="entry.type"
                  :label="t('contentEditor.attributes.custom.type')"
                  label-placement="stacked"
                  interface="popover"
                  class="cap-custom__type"
                  @ion-change="(e: any) => updateCustomType(entry.key, e.detail.value as CustomValueType)"
                >
                  <IonSelectOption value="string">
                    {{ t('contentEditor.attributes.custom.typeString') }}
                  </IonSelectOption>
                  <IonSelectOption value="number">
                    {{ t('contentEditor.attributes.custom.typeNumber') }}
                  </IonSelectOption>
                  <IonSelectOption value="tags">
                    {{ t('contentEditor.attributes.custom.typeTags') }}
                  </IonSelectOption>
                </IonSelect>
                <IonButton
                  fill="clear"
                  color="danger"
                  size="small"
                  class="cap-custom__remove"
                  :aria-label="t('common.delete')"
                  @click="removeCustomField(entry.key)"
                >
                  <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
                  <IonIcon slot="icon-only" :icon="trashOutline" />
                </IonButton>
              </div>
              <div class="cap-custom__row">
                <IonInput
                  v-if="entry.type === 'string'"
                  :value="entry.value as string"
                  :label="t('contentEditor.attributes.custom.value')"
                  label-placement="stacked"
                  @ion-input="(e: any) => updateCustomField(entry.key, { value: e.detail.value ?? '' })"
                />
                <IonInput
                  v-else-if="entry.type === 'number'"
                  type="number"
                  :value="entry.value as number"
                  :label="t('contentEditor.attributes.custom.value')"
                  label-placement="stacked"
                  @ion-input="(e: any) => updateCustomField(entry.key, { value: numberFromInput(e.detail.value) ?? 0 })"
                />
                <div v-else class="cap-custom__tags">
                  <IonLabel position="stacked">
                    {{ t('contentEditor.attributes.custom.value') }}
                  </IonLabel>
                  <TagsInput
                    :model-value="(entry.value as string[]) ?? []"
                    @update:model-value="(v) => updateCustomField(entry.key, { value: v })"
                  />
                </div>
              </div>
              <div class="cap-custom__key">
                <code>{{ entry.key }}</code>
              </div>
            </div>
          </IonItem>
        </IonList>

        <!-- Add-field mini form -->
        <div class="cap-custom-add">
          <IonInput
            v-model="newCustomLabel"
            :label="t('contentEditor.attributes.custom.newLabel')"
            label-placement="stacked"
            :placeholder="t('contentEditor.attributes.custom.newLabelPlaceholder')"
            class="cap-custom-add__label"
          />
          <IonSelect
            v-model="newCustomType"
            :label="t('contentEditor.attributes.custom.type')"
            label-placement="stacked"
            interface="popover"
            class="cap-custom-add__type"
          >
            <IonSelectOption value="string">
              {{ t('contentEditor.attributes.custom.typeString') }}
            </IonSelectOption>
            <IonSelectOption value="number">
              {{ t('contentEditor.attributes.custom.typeNumber') }}
            </IonSelectOption>
            <IonSelectOption value="tags">
              {{ t('contentEditor.attributes.custom.typeTags') }}
            </IonSelectOption>
          </IonSelect>
          <IonButton
            fill="solid"
            size="default"
            class="cap-custom-add__btn"
            :disabled="!newCustomLabel.trim()"
            @click="addCustomField"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="start" :icon="addOutline" />
            {{ t('contentEditor.attributes.custom.add') }}
          </IonButton>
        </div>
        <IonNote v-if="newCustomError === 'labelRequired'" class="cap-note cap-note--error">
          {{ t('contentEditor.attributes.custom.labelRequired') }}
        </IonNote>
      </div>

      <!-- ═══ AI control ═══ -->
      <div class="cap-section">
        <IonListHeader class="cap-section__header">
          <IonLabel>{{ t('contentEditor.attributes.ai.heading') }}</IonLabel>
        </IonListHeader>
        <IonList class="cap-list">
          <IonItem>
            <IonLabel>{{ t('contentEditor.attributes.ai.promptInject') }}</IonLabel>
            <IonToggle slot="end" v-model="promptInject" />
          </IonItem>
        </IonList>
        <IonNote class="cap-note cap-note--sub">
          {{ t('contentEditor.attributes.ai.promptInjectHelper') }}
        </IonNote>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cap {
  padding-bottom: env(safe-area-inset-bottom, var(--adv-space-md));
}

.cap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md) var(--adv-space-md) 4px;
}

.cap-header__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: var(--adv-font-body-sm);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--adv-text-primary);
}

.cap-note {
  display: block;
  padding: 0 var(--adv-space-md) var(--adv-space-sm);
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
  line-height: 1.4;
}

.cap-note--sub {
  padding-top: 4px;
}

.cap-body {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.cap-segment {
  margin: 0 var(--adv-space-md);
}

.cap-section {
  margin-top: var(--adv-space-sm);
}

.cap-section__header {
  --color: var(--adv-text-primary);
  font-weight: 700;
  font-size: var(--adv-font-body-sm);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.cap-list {
  --ion-item-background: transparent;
}

.cap-field {
  width: 100%;
  padding: var(--adv-space-sm) 0;
}

/* Six-stat compact grid */
.cap-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: var(--adv-space-sm) var(--adv-space-md);
}

.cap-stats__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
}

.cap-stats__label {
  font-size: var(--adv-font-caption);
  text-transform: uppercase;
  color: var(--adv-text-tertiary);
  letter-spacing: 0.08em;
  font-weight: 600;
}

.cap-stats__input {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  font-size: var(--adv-font-body);
  font-weight: 600;
  min-height: 28px;
}

@media (max-width: 375px) {
  .cap-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ═══ Custom fields ═══ */
.cap-note--error {
  color: var(--ion-color-danger);
}

.cap-custom-item {
  --inner-padding-end: 0;
  --padding-start: var(--adv-space-md);
}

.cap-custom {
  width: 100%;
  padding: var(--adv-space-sm) 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cap-custom__row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  width: 100%;
}

.cap-custom__row--head {
  /* label grows, type is fixed, remove button hugs the right. */
  align-items: flex-end;
}

.cap-custom__row--head > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.cap-custom__type {
  flex: 0 0 120px;
}

.cap-custom__remove {
  --padding-start: 8px;
  --padding-end: 8px;
  margin-bottom: 2px;
  min-width: 44px;
  min-height: 44px;
}

.cap-custom__tags {
  width: 100%;
}

.cap-custom__key {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  font-family: var(--ion-font-family-mono, monospace);
}

.cap-custom__key code {
  background: var(--adv-surface-elevated);
  padding: 1px 6px;
  border-radius: var(--adv-radius-xs);
}

.cap-custom-add {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border: 2px dashed var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  margin: var(--adv-space-sm) var(--adv-space-md) 0;
  background: var(--adv-surface-card);
}

.cap-custom-add__label {
  flex: 1 1 auto;
  min-width: 0;
}

.cap-custom-add__type {
  flex: 0 0 120px;
}

.cap-custom-add__btn {
  flex: 0 0 auto;
  --border-radius: var(--adv-radius-md);
  text-transform: none;
  min-height: 40px;
}

@media (max-width: 480px) {
  .cap-custom-add,
  .cap-custom__row--head {
    flex-wrap: wrap;
  }
  .cap-custom-add__btn {
    width: 100%;
  }
}
</style>
