<script setup lang="ts">
import type { MarketplaceRecord, ReviewRecord, SortMode } from '../../composables/useMarketplace'
import {
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSearchbar,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  cloudDownloadOutline,
  cloudUploadOutline,
  heartOutline,
  personOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LayoutPage from '../../components/common/LayoutPage.vue'
import { useCloudbase } from '../../composables/useCloudbase'
import { useMarketplace } from '../../composables/useMarketplace'
import { useProjectContent } from '../../composables/useProjectContent'
import { exportProject, importProject } from '../../composables/useProjectExport'
import { useAuthStore } from '../../stores/useAuthStore'
import { useStudioStore } from '../../stores/useStudioStore'
import { MemoryFsAdapter } from '../../utils/fs/MemoryFsAdapter'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const studioStore = useStudioStore()
const { getFs, stats: projectStats } = useProjectContent()
const {
  isBusy,
  browseMarket,
  incrementDownloads,
  submitReview,
  fetchReviews,
  likeReview,
  publishProject,
} = useMarketplace()

let cloudApp: ReturnType<typeof useCloudbase>['app'] | null = null
try {
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

const items = ref<MarketplaceRecord[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const selectedTag = ref<string | null>(null)
const sortMode = ref<SortMode>('newest')
const selectedItem = ref<MarketplaceRecord | null>(null)

// Review state
const reviews = ref<ReviewRecord[]>([])
const reviewRating = ref(5)
const reviewComment = ref('')
const isReviewLoading = ref(false)

// Install state
const isInstalling = ref(false)

// Publish state
const isPublishing = ref(false)

const allTags = computed(() => {
  const tags = new Set<string>()
  for (const item of items.value) {
    for (const tag of item.tags)
      tags.add(tag)
  }
  return [...tags]
})

const filteredItems = computed(() => {
  if (!searchQuery.value)
    return items.value
  const q = searchQuery.value.toLowerCase()
  return items.value.filter(i =>
    i.name.toLowerCase().includes(q)
    || (i.description || '').toLowerCase().includes(q)
    || i.authorName.toLowerCase().includes(q),
  )
})

onMounted(async () => {
  await loadMarket()
})

async function loadMarket() {
  if (!cloudApp)
    return
  isLoading.value = true
  try {
    items.value = await browseMarket(cloudApp, {
      tag: selectedTag.value || undefined,
      sort: sortMode.value,
      limit: 50,
    })
  }
  finally {
    isLoading.value = false
  }
}

async function selectItem(item: MarketplaceRecord) {
  selectedItem.value = item
  if (cloudApp && item._id) {
    isReviewLoading.value = true
    reviews.value = await fetchReviews(cloudApp, item._id)
    isReviewLoading.value = false
  }
}

function getAverageRating(item: MarketplaceRecord): string {
  if (!item.ratingCount)
    return '—'
  return (item.ratingSum / item.ratingCount).toFixed(1)
}

function formatDownloads(n: number): string {
  if (n >= 1000)
    return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

async function handleInstall() {
  if (!cloudApp || !selectedItem.value?.packageKey)
    return

  isInstalling.value = true
  try {
    // Download .advpkg.zip from COS via CloudBase storage
    const fileRes = await cloudApp.getTempFileURL({
      fileList: [selectedItem.value.packageKey],
    })
    const url = fileRes.fileList?.[0]?.tempFileURL
    if (!url)
      throw new Error('Failed to get download URL')

    const response = await fetch(url)
    const blob = await response.blob()
    const zipFile = new File([blob], `${selectedItem.value.projectId}.advpkg.zip`)

    // Import into MemoryFs
    const projectId = selectedItem.value.projectId
    const memFs = new MemoryFsAdapter(projectId)
    const manifest = await importProject(zipFile, memFs)

    // Add and switch to project
    await studioStore.switchProject({
      projectId,
      name: manifest.name,
      source: 'local' as const,
      lastOpened: Date.now(),
      description: selectedItem.value.description,
      cover: selectedItem.value.cover,
    })

    // Increment download count
    if (selectedItem.value._id)
      await incrementDownloads(cloudApp, selectedItem.value._id)

    selectedItem.value = null
    const toast = await toastController.create({
      message: t('marketplace.installSuccess'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
  }
  catch (err) {
    const toast = await toastController.create({
      message: `${t('marketplace.installFailed')}: ${err instanceof Error ? err.message : String(err)}`,
      duration: 3000,
      position: 'top',
    })
    await toast.present()
  }
  finally {
    isInstalling.value = false
  }
}

async function handleSubmitReview() {
  if (!cloudApp || !selectedItem.value?._id || !authStore.isLoggedIn)
    return

  const ok = await submitReview(
    cloudApp,
    selectedItem.value._id,
    reviewRating.value,
    reviewComment.value,
  )

  if (ok) {
    reviewComment.value = ''
    reviews.value = await fetchReviews(cloudApp, selectedItem.value._id)
    const toast = await toastController.create({
      message: t('marketplace.reviewSubmitted'),
      duration: 1500,
      position: 'top',
    })
    await toast.present()
  }
}

async function handlePublish() {
  if (!cloudApp || !authStore.isLoggedIn)
    return

  const project = studioStore.currentProject
  if (!project) {
    const toast = await toastController.create({
      message: t('portfolio.noProject'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
    return
  }

  isPublishing.value = true
  try {
    const realStats = {
      chapters: projectStats.value.chapters,
      characters: projectStats.value.characters,
      scenes: projectStats.value.scenes,
    }

    const fs = getFs()
    if (!fs)
      throw new Error(t('portfolio.noProject'))

    const blob = await exportProject(fs, project.name || project.projectId)
    const packageSize = blob.size
    const cloudPath = `marketplace/${project.projectId}/${Date.now()}.advpkg.zip`
    const file = new File([blob], `${project.projectId}.advpkg.zip`)
    const uploadResult = await cloudApp.uploadFile({
      cloudPath,
      filePath: file as any,
    })

    if (!uploadResult.fileID)
      throw new Error(t('marketplace.publishFailed'))

    const marketId = await publishProject(cloudApp, project, {
      tags: [],
      stats: realStats,
      version: '1.0.0',
      packageKey: uploadResult.fileID,
      packageSize,
    })

    if (!marketId)
      throw new Error(t('marketplace.publishFailed'))

    const toast = await toastController.create({
      message: t('marketplace.publishSuccess'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
    await loadMarket()
  }
  catch (err) {
    const toast = await toastController.create({
      message: `${t('marketplace.publishFailed')}: ${err instanceof Error ? err.message : String(err)}`,
      duration: 3000,
      position: 'top',
    })
    await toast.present()
  }
  finally {
    isPublishing.value = false
  }
}

function navigateToCreator(ownerId: string) {
  selectedItem.value = null
  router.push(`/creator/${ownerId}`)
}

async function handleLikeReview(reviewId: string) {
  if (!cloudApp)
    return
  await likeReview(cloudApp, reviewId)
  // Optimistic update
  const review = reviews.value.find(r => r._id === reviewId)
  if (review)
    review.likes += 1
}

function onTagChange(tag: string | null) {
  selectedTag.value = tag
  loadMarket()
}

function onSortChange(mode: SortMode) {
  sortMode.value = mode
  loadMarket()
}
</script>

<template>
  <LayoutPage :title="t('marketplace.title')" show-back-button default-href="/tabs/workspace">
    <template #header-extra>
      <IonToolbar>
        <IonSearchbar
          v-model="searchQuery"
          :placeholder="t('marketplace.search')"
          :debounce="200"
        />
      </IonToolbar>
    </template>

    <div class="market-toolbar">
      <!-- Sort -->
      <div class="sort-chips">
        <IonChip :color="sortMode === 'newest' ? 'primary' : undefined" @click="onSortChange('newest')">
          {{ t('marketplace.sortNewest') }}
        </IonChip>
        <IonChip :color="sortMode === 'popular' ? 'primary' : undefined" @click="onSortChange('popular')">
          {{ t('marketplace.sortPopular') }}
        </IonChip>
        <IonChip :color="sortMode === 'rating' ? 'primary' : undefined" @click="onSortChange('rating')">
          {{ t('marketplace.sortRating') }}
        </IonChip>
      </div>

      <!-- Publish button -->
      <button
        v-if="authStore.isLoggedIn"
        class="publish-btn"
        :disabled="isPublishing || !studioStore.currentProject"
        @click="handlePublish"
      >
        <IonIcon :icon="cloudUploadOutline" />
        {{ t('marketplace.publish') }}
        <IonSpinner v-if="isPublishing" name="dots" />
      </button>
    </div>

    <!-- Tag filter chips -->
    <div v-if="allTags.length > 0" class="tag-chips">
      <IonChip
        :color="selectedTag === null ? 'primary' : undefined"
        @click="onTagChange(null)"
      >
        {{ t('world.timelineFilterAll') }}
      </IonChip>
      <IonChip
        v-for="tag in allTags"
        :key="tag"
        :color="selectedTag === tag ? 'primary' : undefined"
        @click="onTagChange(tag)"
      >
        {{ tag }}
      </IonChip>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="market-loading">
      <IonSpinner name="crescent" />
    </div>

    <!-- Card grid -->
    <div v-else-if="filteredItems.length > 0" class="market-grid">
      <button
        v-for="item in filteredItems"
        :key="item._id"
        class="market-card"
        @click="selectItem(item)"
      >
        <div class="market-card__cover">
          <img v-if="item.cover" :src="item.cover" alt="">
          <span v-else class="market-card__cover-fallback">{{ item.name.charAt(0) }}</span>
        </div>
        <div class="market-card__body">
          <div class="market-card__title">
            {{ item.name }}
          </div>
          <div class="market-card__author">
            {{ item.authorName }}
          </div>
          <div class="market-card__meta">
            <span>👥 {{ item.stats.characters }}</span>
            <span>📖 {{ item.stats.chapters }}</span>
            <span>⬇️ {{ formatDownloads(item.downloads) }}</span>
            <span>⭐ {{ getAverageRating(item) }}</span>
          </div>
        </div>
      </button>
    </div>

    <!-- Empty -->
    <div v-else class="market-empty">
      <p>{{ t('marketplace.empty') }}</p>
    </div>

    <!-- Detail Modal -->
    <IonModal :is-open="!!selectedItem" @did-dismiss="selectedItem = null">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{{ selectedItem?.name }}</IonTitle>
          <IonButtons slot="end">
            <button class="market-close-btn" @click="selectedItem = null">
              ✕
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent v-if="selectedItem" class="ion-padding">
        <div class="market-detail">
          <div class="market-detail__cover">
            <img v-if="selectedItem.cover" :src="selectedItem.cover" alt="">
            <span v-else class="market-detail__cover-fallback">{{ selectedItem.name.charAt(0) }}</span>
          </div>
          <h2 class="market-detail__title">
            {{ selectedItem.name }}
          </h2>
          <button class="market-detail__author-link" @click="navigateToCreator(selectedItem.ownerId)">
            <IonIcon :icon="personOutline" />
            {{ selectedItem.authorName }}
          </button>
          <p class="market-detail__desc">
            {{ selectedItem.description || t('portfolio.noDescription') }}
          </p>

          <!-- Character preview cards -->
          <div class="market-detail__stats">
            <div class="market-detail__stat">
              <strong>{{ selectedItem.stats.characters }}</strong>
              <span>{{ t('preview.charactersCount') }}</span>
            </div>
            <div class="market-detail__stat">
              <strong>{{ selectedItem.stats.chapters }}</strong>
              <span>{{ t('preview.chaptersCount') }}</span>
            </div>
            <div class="market-detail__stat">
              <strong>{{ formatDownloads(selectedItem.downloads) }}</strong>
              <span>{{ t('marketplace.downloads') }}</span>
            </div>
            <div class="market-detail__stat">
              <strong>⭐ {{ getAverageRating(selectedItem) }}</strong>
              <span>{{ t('marketplace.rating') }} ({{ selectedItem.ratingCount }})</span>
            </div>
          </div>

          <div v-if="selectedItem.tags.length" class="market-detail__tags">
            <IonChip v-for="tag in selectedItem.tags" :key="tag" color="medium">
              {{ tag }}
            </IonChip>
          </div>

          <!-- Install button -->
          <button
            class="market-detail__install"
            :disabled="isInstalling || !selectedItem.packageKey"
            @click="handleInstall"
          >
            <IonSpinner v-if="isInstalling" name="dots" />
            <IonIcon v-else :icon="cloudDownloadOutline" />
            {{ isInstalling ? t('marketplace.installing') : t('marketplace.install') }}
          </button>

          <!-- Reviews section -->
          <div class="reviews-section">
            <h3>{{ t('marketplace.reviews') }} ({{ reviews.length }})</h3>

            <!-- Submit review -->
            <div v-if="authStore.isLoggedIn" class="review-form">
              <div class="review-form__stars">
                <button
                  v-for="star in 5"
                  :key="star"
                  class="star-btn"
                  :class="{ 'star-btn--active': star <= reviewRating }"
                  @click="reviewRating = star"
                >
                  ★
                </button>
              </div>
              <IonTextarea
                v-model="reviewComment"
                :placeholder="t('marketplace.reviewPlaceholder')"
                :rows="2"
                :auto-grow="true"
              />
              <button
                class="review-submit-btn"
                :disabled="isBusy || !reviewComment.trim()"
                @click="handleSubmitReview"
              >
                {{ t('marketplace.submitReview') }}
              </button>
            </div>

            <!-- Review list -->
            <div v-if="isReviewLoading" class="market-loading">
              <IonSpinner name="dots" />
            </div>
            <div v-else class="review-list">
              <div v-for="review in reviews" :key="review._id" class="review-item">
                <div class="review-item__header">
                  <span class="review-item__author">{{ review.reviewerName }}</span>
                  <span class="review-item__stars">
                    <span v-for="s in 5" :key="s" :class="{ dimmed: s > review.rating }">★</span>
                  </span>
                </div>
                <p class="review-item__comment">
                  {{ review.comment }}
                </p>
                <div class="review-item__footer">
                  <span>{{ new Date(review.createdAt).toLocaleDateString() }}</span>
                  <button class="review-like-btn" @click="handleLikeReview(review._id!)">
                    <IonIcon :icon="heartOutline" />
                    {{ review.likes }}
                  </button>
                </div>
              </div>
              <p v-if="reviews.length === 0" class="review-empty">
                {{ t('marketplace.noReviews') }}
              </p>
            </div>
          </div>
        </div>
      </IonContent>
    </IonModal>
  </LayoutPage>
</template>

<style scoped>
.market-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-sm) var(--adv-space-md) 0;
  gap: var(--adv-space-sm);
}

.sort-chips {
  display: flex;
  gap: 4px;
}

.publish-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--adv-radius-sm);
  border: 1.5px solid var(--ion-color-primary);
  background: transparent;
  color: var(--ion-color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tag-chips {
  display: flex;
  gap: 4px;
  padding: var(--adv-space-sm) var(--adv-space-md);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.market-loading {
  display: flex;
  justify-content: center;
  padding: var(--adv-space-2xl);
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--adv-space-md);
  padding: 0 var(--adv-space-md) var(--adv-space-xl);
}

.market-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg, 12px);
  overflow: hidden;
  background: var(--adv-surface-card);
  cursor: pointer;
  text-align: left;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.market-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--adv-shadow-card, 0 4px 12px rgba(0, 0, 0, 0.08));
}

.market-card__cover {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--adv-gradient-surface);
  overflow: hidden;
}

.market-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.market-card__cover-fallback {
  font-size: 32px;
  font-weight: 700;
  color: var(--adv-text-tertiary);
  opacity: 0.3;
}

.market-card__body {
  padding: var(--adv-space-sm);
}

.market-card__title {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-card__author {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary);
  margin-top: 2px;
}

.market-card__meta {
  display: flex;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-xs);
  font-size: 10px;
  color: var(--adv-text-tertiary);
}

.market-empty {
  text-align: center;
  padding: var(--adv-space-2xl);
  color: var(--adv-text-tertiary);
}

/* Detail modal */
.market-close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--adv-text-secondary);
  cursor: pointer;
  padding: 8px;
}

.market-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--adv-space-sm);
}

.market-detail__cover {
  width: 80px;
  height: 80px;
  border-radius: var(--adv-radius-md);
  overflow: hidden;
  background: var(--adv-gradient-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.market-detail__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.market-detail__cover-fallback {
  font-size: 32px;
  font-weight: 700;
  color: var(--adv-text-tertiary);
  opacity: 0.3;
}

.market-detail__title {
  font-size: var(--adv-font-subtitle, 18px);
  font-weight: 700;
  margin: 0;
}

.market-detail__author-link {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--ion-color-primary);
  font-size: var(--adv-font-body-sm);
  cursor: pointer;
}

.market-detail__desc {
  font-size: var(--adv-font-body);
  color: var(--adv-text-primary);
  line-height: 1.6;
  max-width: 400px;
}

.market-detail__stats {
  display: flex;
  gap: var(--adv-space-lg);
  margin: var(--adv-space-md) 0;
}

.market-detail__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.market-detail__stat strong {
  font-size: var(--adv-font-body);
}
.market-detail__stat span {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.market-detail__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.market-detail__install {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: 12px 24px;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-gradient-primary);
  color: #fff;
  font-size: var(--adv-font-body);
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-top: var(--adv-space-md);
}

.market-detail__install:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Reviews */
.reviews-section {
  width: 100%;
  max-width: 500px;
  margin-top: var(--adv-space-lg);
  text-align: left;
}

.reviews-section h3 {
  font-size: var(--adv-font-body);
  font-weight: 600;
  margin: 0 0 var(--adv-space-sm);
}

.review-form {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
  margin-bottom: var(--adv-space-md);
  padding: var(--adv-space-sm);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
}

.review-form__stars {
  display: flex;
  gap: 4px;
}

.star-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--adv-text-tertiary);
  cursor: pointer;
  padding: 0;
}

.star-btn--active {
  color: #f59e0b;
}

.review-submit-btn {
  align-self: flex-end;
  padding: 6px 16px;
  border-radius: var(--adv-radius-sm);
  border: none;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.review-submit-btn:disabled {
  opacity: 0.5;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.review-item {
  padding: var(--adv-space-sm);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
}

.review-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.review-item__author {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
}
.review-item__stars {
  font-size: 14px;
  color: #f59e0b;
}
.review-item__stars .dimmed {
  color: var(--adv-text-tertiary);
  opacity: 0.3;
}
.review-item__comment {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-primary);
  margin: 4px 0;
  line-height: 1.5;
}
.review-item__footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--adv-text-tertiary);
}

.review-like-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--adv-text-tertiary);
  font-size: 11px;
  cursor: pointer;
}

.review-empty {
  text-align: center;
  color: var(--adv-text-tertiary);
  font-size: var(--adv-font-body-sm);
}
</style>
