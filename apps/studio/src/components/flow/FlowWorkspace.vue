<script setup lang="ts">
import { createFlowNode, FLOW_NODE_KINDS, flowDocumentRevision } from '@advjs/core'
import { computed, shallowRef, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFlowAuthoring } from '../../composables/useFlowAuthoring'
import { useProjectContent } from '../../composables/useProjectContent'
import { useStudioStore } from '../../stores/useStudioStore'
import { createStudioFlowAuthoringService } from '../../utils/flowAuthoring'
import SButton from '../ui/SButton.vue'
import SSelect from '../ui/SSelect.vue'
import FlowGraph from './FlowGraph.vue'
import FlowNodeEditor from './FlowNodeEditor.vue'
import FlowNodeList from './FlowNodeList.vue'
import FlowToolbar from './FlowToolbar.vue'
import './flow.css'

const props = withDefaults(defineProps<{ active: boolean, initialFile?: string }>(), { initialFile: '' })
const emit = defineEmits<{ play: [path: string] }>()
const { t } = useI18n()
const project = useProjectContent()
const studio = useStudioStore()
const file = shallowRef(props.initialFile)
const kind = shallowRef('dialogues')
const newId = shallowRef('')
const newTitle = shallowRef('')
const creating = shallowRef(false)
const creationError = shallowRef('')
const flowChapters = computed(() => project.chapters.value.filter(chapter => chapter.file.endsWith('.chapter.json')))
watch([flowChapters, () => props.initialFile], () => {
  if (!file.value || !flowChapters.value.some(chapter => chapter.file === file.value))
    file.value = props.initialFile || flowChapters.value[0]?.file || ''
}, { immediate: true })
const { document, graph, selectedId, selected, dirty, busy, error, validation, canUndo, canRedo, dispatch, add, undo, redo, reload, validate, save } = useFlowAuthoring(toRef(props, 'active'), file)
const selectedIndex = computed(() => document.value?.nodes.findIndex(node => node.id === selectedId.value) ?? -1)
const resources = shallowRef<NonNullable<typeof validation.value>['compilation']['project']['assets']>()
watch(validation, (value) => {
  if (value)
    resources.value = value.compilation.project.assets
})
async function createChapter() {
  const fs = project.getFs()
  if (!fs || creating.value || !props.active)
    return
  const projectId = studio.currentProjectId
  creating.value = true
  creationError.value = ''
  try {
    if (!/^[a-z0-9][\w-]{0,79}$/iu.test(newId.value) || !newTitle.value.trim())
      throw new Error('ADV_FLOW_CHAPTER_ID_REQUIRED')
    const path = `adv/chapters/${newId.value}.chapter.json`
    if (await fs.exists(path))
      throw new Error('ADV_FLOW_SOURCE_CONFLICT')
    const start = createFlowNode('start')
    const end = createFlowNode('end')
    start.next = end.id
    const service = createStudioFlowAuthoringService(fs, () => {
      if (projectId !== studio.currentProjectId || !props.active)
        throw new Error('ADV_FLOW_SCOPE_CHANGED')
    })
    await service.create({ path, document: { schemaVersion: 1, id: newId.value, title: newTitle.value.trim(), startNodeId: start.id, nodes: [start, end] }, expectedRevision: await flowDocumentRevision(null) })
    await project.reload()
    file.value = path
    newId.value = ''
    newTitle.value = ''
  }
  catch (cause) { creationError.value = cause instanceof Error ? cause.message : 'ADV_FLOW_REQUEST_FAILED' }
  finally { creating.value = false }
}
</script>

<template>
  <div class="flow-workspace" data-testid="flow-workspace" :aria-busy="busy || creating">
    <header><h2>{{ t('flowEditor.title') }}</h2><p>{{ t('flowEditor.intro') }}</p></header>
    <label>{{ t('flowEditor.chapter') }}<SSelect v-model="file" size="lg" :disabled="busy || dirty" :options="flowChapters.map(chapter => ({ value: chapter.file, label: chapter.name }))" :placeholder="t('flowEditor.chooseChapter')" /></label>
    <p v-if="dirty">
      {{ t('flowEditor.switchHint') }}
    </p>
    <p v-if="error || creationError" class="flow-error" role="alert">
      {{ error || creationError }}
    </p>
    <template v-if="document">
      <label>{{ t('flowEditor.chapterTitle') }}<input :value="document.title" :disabled="busy" @change="dispatch({ type: 'set-title', title: ($event.target as HTMLInputElement).value })"></label>
      <FlowToolbar :dirty="dirty" :busy="busy" :can-undo="canUndo" :can-redo="canRedo" @undo="undo" @redo="redo" @reload="reload" @validate="validate" @save="save" />
      <div class="flow-actions">
        <SButton size="lg" variant="outline" :disabled="busy || dirty" @click="emit('play', file)">
          {{ t('flowEditor.preview') }}
        </SButton><label>{{ t('flowEditor.nodeKind') }}<SSelect v-model="kind" size="lg" :disabled="busy" :options="FLOW_NODE_KINDS.map(value => ({ value, label: t(`flowEditor.kinds.${value}`) }))" /></label><SButton size="lg" :disabled="busy" @click="add(kind as typeof FLOW_NODE_KINDS[number])">
          {{ t('flowEditor.addNode') }}
        </SButton>
      </div>
      <section v-if="validation" class="flow-validation" aria-live="polite">
        <strong>{{ t(validation.valid ? 'flowEditor.valid' : 'flowEditor.invalid') }}</strong><ul v-if="validation.diagnostics.length">
          <li v-for="(issue, index) in validation.diagnostics" :key="index">
            {{ issue.code }} · {{ issue.message }}
          </li>
        </ul>
      </section>
      <FlowGraph :document="document" :edges="graph.edges" :selected-id="selectedId" @select="selectedId = $event" />
      <div class="flow-workspace__editor">
        <FlowNodeList :document="document" :edges="graph.edges" :selected-id="selectedId" @select="selectedId = $event" />
        <FlowNodeEditor v-if="selected" :key="selected.id" :node="selected" :index="selectedIndex" :busy="busy" :assets="resources?.assets ?? []" @command="dispatch" />
      </div>
    </template>
    <details class="flow-new-chapter">
      <summary>{{ t('flowEditor.newChapter') }}</summary><p>{{ t('flowEditor.newChapterHint') }}</p><div class="flow-fields">
        <label>{{ t('flowEditor.chapterId') }}<input v-model="newId" :disabled="creating"></label><label>{{ t('flowEditor.chapterTitle') }}<input v-model="newTitle" :disabled="creating"></label>
      </div><SButton size="lg" :disabled="creating || busy || dirty || !newId || !newTitle" :loading="creating" @click="createChapter">
        {{ t('flowEditor.createChapter') }}
      </SButton>
    </details>
  </div>
</template>
