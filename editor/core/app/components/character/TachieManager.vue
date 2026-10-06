<script setup lang="ts">
import type { AdvCharacter, AdvTachie } from '@advjs/types'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useProjectAssets } from '../../stores/useProjectAssets'
import { useProjectDrafts } from '../../stores/useProjectDrafts'
import '../../styles/resource-panel.scss'

const props = defineProps<{ character: AdvCharacter, save?: (tachies: Record<string, AdvTachie>) => Promise<void> }>()
const emit = defineEmits<{ update: [tachies: Record<string, AdvTachie>] }>()
const fieldId = useId()
const assets = useProjectAssets()
const characters = useCharacterStore()
const project = useProjectStore()
const importError = ref('')
const thumbnails = ref<Record<string, string>>({})
const newTachieName = ref('')
const newTachieSrc = ref('')
const tachies = computed(() => props.character.tachies ?? {})
const duplicate = computed(() => Object.hasOwn(tachies.value, newTachieName.value.trim()))
const canAdd = computed(() => !!newTachieName.value.trim() && !!newTachieSrc.value.trim() && !duplicate.value)
const drafts = useProjectDrafts()
watch(() => Boolean(newTachieName.value || newTachieSrc.value), dirty => drafts.register(fieldId, { dirty, save: async () => {
  if (!canAdd.value) {
    importError.value = '请填写有效且不重复的立绘名称与资源路径'
    return false
  }
  await addTachie()
  return !importError.value
} }), { immediate: true })
onBeforeUnmount(() => drafts.remove(fieldId))
let thumbnailGeneration = 0
watch(() => [JSON.stringify(props.character.tachies), project.resourceRevision], async () => {
  const generation = ++thumbnailGeneration
  const next: Record<string, string> = {}
  let failure = ''
  for (const [name, tachie] of Object.entries(props.character.tachies ?? {})) {
    try {
      next[name] = await project.projectAssetUrl(tachie.src)
    }
    catch {
      failure = `立绘资源缺失：${tachie.src}`
    }
  }
  if (generation !== thumbnailGeneration) {
    for (const url of Object.values(next)) {
      if (url.startsWith('blob:'))
        URL.revokeObjectURL(url)
    }
    return
  }
  for (const url of Object.values(thumbnails.value)) {
    if (url.startsWith('blob:'))
      URL.revokeObjectURL(url)
  }
  thumbnails.value = next
  importError.value = failure
}, { immediate: true })
onBeforeUnmount(() => {
  thumbnailGeneration++
  for (const url of Object.values(thumbnails.value)) {
    if (url.startsWith('blob:'))
      URL.revokeObjectURL(url)
  }
})
async function importTachie(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const name = newTachieName.value.trim() || 'default'
  const expected = characters.characterSource(props.character.id)
  let retained = ''
  try {
    const imported = await assets.importFile(file, 'tachie', props.character.id)
    retained = imported.src
    await characters.updateCharacter({ ...props.character, tachies: { ...tachies.value, [name]: { src: imported.src } } }, expected)
    importError.value = ''
  }
  catch (failure) {
    importError.value = `${String(failure)}${retained ? `；已导入资源保留在素材清单，可恢复使用：${retained}` : ''}`
  }
  finally {
    input.value = ''
  }
}
watch(() => props.character.id, () => {
  newTachieName.value = ''
  newTachieSrc.value = ''
})

async function addTachie() {
  if (!canAdd.value)
    return
  try {
    const next = { ...tachies.value, [newTachieName.value.trim()]: { src: newTachieSrc.value.trim() } }
    if (props.save)
      await props.save(next)
    else emit('update', next)
    newTachieName.value = ''
    newTachieSrc.value = ''
    importError.value = ''
  }
  catch (failure) {
    importError.value = String(failure)
  }
}
async function removeTachie(key: string) {
  const next = { ...tachies.value }
  delete next[key]
  try {
    if (props.save)
      await props.save(next)
    else emit('update', next)
    importError.value = ''
  }
  catch (failure) {
    importError.value = String(failure)
  }
}
</script>

<template>
  <AGUIDetails class="ae-resource-panel" :title="$t('characters.detail.tachies')" open>
    <label v-if="project.workspace" class="ae-resource-row">导入或替换立绘<input type="file" accept="image/*" aria-label="导入立绘" @change="importTachie"></label>
    <p v-if="importError" class="ae-resource-error" role="alert">
      {{ importError }}
    </p>
    <ul v-if="Object.keys(tachies).length" class="ae-resource-list">
      <li v-for="(tachie, key) in tachies" :key="key" class="ae-resource-row">
        <img v-if="tachie" class="ae-resource-thumb" :src="thumbnails[String(key)] ?? tachie.src" :alt="String(key)" loading="lazy">
        <div class="ae-resource-meta">
          <div class="ae-resource-name">
            {{ key }}
          </div>
          <div class="ae-resource-caption">
            {{ tachie?.src }}
          </div>
        </div>
        <AGUIIconButton icon="i-ri-delete-bin-line" :title="$t('characters.tachie.remove', { name: key })" @click="removeTachie(String(key))" />
      </li>
    </ul>
    <p v-else class="ae-resource-empty">
      {{ $t('characters.tachie.empty') }}
    </p>
    <form class="ae-resource-form" @submit.prevent="addTachie">
      <AGUIProperty :for="`${fieldId}-name`" :label="$t('characters.tachie.name')">
        <AGUIInput :id="`${fieldId}-name`" v-model="newTachieName" :aria-invalid="duplicate || undefined" :aria-describedby="duplicate ? `${fieldId}-error` : undefined" placeholder="normal, angry, smile" />
      </AGUIProperty>
      <AGUIProperty :for="`${fieldId}-src`" :label="$t('characters.tachie.src')">
        <AGUIInput :id="`${fieldId}-src`" v-model="newTachieSrc" placeholder="/tachies/normal.png" />
      </AGUIProperty>
      <p v-if="duplicate" :id="`${fieldId}-error`" class="ae-resource-error" role="alert">
        {{ $t('characters.tachie.duplicate') }}
      </p>
      <div class="ae-resource-actions">
        <AGUIButton type="submit" icon="i-ri-add-line" :disabled="!canAdd">
          {{ $t('characters.tachie.add') }}
        </AGUIButton>
      </div>
    </form>
  </AGUIDetails>
</template>
