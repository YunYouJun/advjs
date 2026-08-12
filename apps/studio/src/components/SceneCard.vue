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
import { cloudUploadOutline, imageOutline, sparklesOutline } from 'ionicons/icons'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useProjectContent } from '../composables/useProjectContent'
import { loadStudioAssetCatalog } from '../utils/projectAssets'

const props = defineProps<{
  scene: SceneInfo
  isGenerating?: boolean
  isPublishing?: boolean
  aiAvailable?: boolean
}>()

defineEmits<{
  click: [scene: SceneInfo]
  generateImage: [scene: SceneInfo]
  publish: [scene: SceneInfo]
}>()

const thumbnailUrl = ref<string | null>(null)
let disposeCatalog: (() => void) | undefined

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
watch(() => [props.scene.src, props.scene.assetId] as const, async ([src, assetId]) => {
  // Revoke previous blob URL
  if (thumbnailUrl.value) {
    URL.revokeObjectURL(thumbnailUrl.value)
    thumbnailUrl.value = null
  }
  disposeCatalog?.()
  disposeCatalog = undefined

  const { getFs } = useProjectContent()
  const fs = getFs()
  if (assetId && fs) {
    try {
      const catalog = await loadStudioAssetCatalog(fs)
      if (catalog) {
        thumbnailUrl.value = (await catalog.resolve(assetId)).src
        disposeCatalog = () => catalog.dispose()
        return
      }
    }
    catch { /* fall through to legacy src */ }
  }

  if (!src || isRemoteUrl.value)
    return

  if (!fs)
    return

  try {
    // Try relative to project root, or relative to adv/scenes/
    const paths = [src, `adv/scenes/${src}`]
    for (const path of paths) {
      try {
        thumbnailUrl.value = await fs.readBlobUrl(path)
        return
      }
      catch { /* try next */ }
    }
  }
  catch { /* ignore */ }
}, { immediate: true })

onUnmounted(() => {
  disposeCatalog?.()
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

    <IonButton
      v-if="scene.assetId"
      class="scene-card__publish"
      fill="solid"
      size="small"
      :disabled="isPublishing"
      :aria-label="$t('assetStorage.publish')"
      @click.stop="$emit('publish', scene)"
    >
      <IonIcon :icon="cloudUploadOutline" />
    </IonButton>

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
  position: relative;
  margin: 0;
  overflow: hidden;
}

.scene-card__publish {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  --border-radius: 999px;
  --padding-start: 8px;
  --padding-end: 8px;
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
  --color: var(--adv-primary);
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
  font-size: var(--adv-font-caption);
  line-height: 1;
  padding: 2px 7px;
  border-radius: var(--adv-radius-full);
  background: rgba(139, 92, 246, 0.08);
  color: var(--adv-primary);
  white-space: nowrap;
}
</style>
