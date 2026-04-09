<script setup lang="ts">
import type { SceneInfo } from '../composables/useProjectContent'
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/vue'
import { imageOutline, sparklesOutline } from 'ionicons/icons'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'
import { readBlobFromDir } from '../utils/fileAccess'

const props = defineProps<{
  scene: SceneInfo
  isGenerating?: boolean
  aiAvailable?: boolean
}>()

defineEmits<{
  click: [scene: SceneInfo]
  generateImage: [scene: SceneInfo]
}>()

const studioStore = useStudioStore()
const thumbnailUrl = ref<string | null>(null)

const isRemoteUrl = computed(() => {
  const src = props.scene.src
  if (!src)
    return false
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')
})

const displayUrl = computed(() => {
  if (isRemoteUrl.value)
    return props.scene.src!
  return thumbnailUrl.value
})

// Load local image as blob URL when src is a relative path
watch(() => props.scene.src, async (src) => {
  // Revoke previous blob URL
  if (thumbnailUrl.value) {
    URL.revokeObjectURL(thumbnailUrl.value)
    thumbnailUrl.value = null
  }

  if (!src || isRemoteUrl.value)
    return

  const project = studioStore.currentProject
  if (!project?.dirHandle)
    return

  try {
    // Try relative to project root, or relative to adv/scenes/
    const paths = [src, `adv/scenes/${src}`]
    for (const path of paths) {
      try {
        thumbnailUrl.value = await readBlobFromDir(project.dirHandle, path)
        return
      }
      catch { /* try next */ }
    }
  }
  catch { /* ignore */ }
}, { immediate: true })

onUnmounted(() => {
  if (thumbnailUrl.value)
    URL.revokeObjectURL(thumbnailUrl.value)
})
</script>

<template>
  <IonCard class="scene-card" button @click="$emit('click', scene)">
    <!-- Thumbnail -->
    <div v-if="displayUrl" class="scene-card__thumb">
      <img :src="displayUrl" alt="" class="scene-card__img" loading="lazy">
    </div>
    <div v-else-if="isGenerating" class="scene-card__thumb scene-card__thumb--placeholder">
      <IonSpinner name="crescent" />
    </div>
    <div v-else-if="scene.imagePrompt && aiAvailable" class="scene-card__thumb scene-card__thumb--placeholder">
      <IonButton
        fill="clear"
        size="small"
        class="scene-card__gen-btn"
        @click.stop="$emit('generateImage', scene)"
      >
        <IonIcon :icon="sparklesOutline" />
        {{ $t('scenes.generateImage') }}
      </IonButton>
    </div>

    <IonCardHeader>
      <IonCardTitle class="scene-card__title">
        <IonIcon :icon="imageOutline" class="scene-card__icon" />
        {{ scene.name }}
      </IonCardTitle>
    </IonCardHeader>
    <IonCardContent>
      <p v-if="scene.description" class="scene-card__desc">
        {{ scene.description }}
      </p>
      <p v-else class="scene-card__file">
        {{ scene.file }}
      </p>
      <div v-if="scene.tags?.length" class="scene-card__tags">
        <span v-for="tag in scene.tags.slice(0, 3)" :key="tag" class="scene-card__tag">
          {{ tag }}
        </span>
      </div>
    </IonCardContent>
  </IonCard>
</template>

<style scoped>
.scene-card {
  margin: 0;
  overflow: hidden;
}

.scene-card__thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--adv-surface-elevated);
}

.scene-card__thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--adv-border-subtle);
}

.scene-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.scene-card__gen-btn {
  --color: #8b5cf6;
  font-size: var(--adv-font-caption);
  font-weight: 600;
}

.scene-card__title {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  font-size: var(--adv-font-body);
  font-weight: 600;
}

.scene-card__icon {
  flex-shrink: 0;
  color: var(--ion-color-tertiary, #5260ff);
}

.scene-card__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scene-card__file {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}

.scene-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: var(--adv-space-xs);
}

.scene-card__tag {
  font-size: 10px;
  line-height: 1;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(139, 92, 246, 0.08);
  color: #8b5cf6;
  white-space: nowrap;
}
</style>
