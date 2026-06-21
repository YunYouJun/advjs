<script setup lang="ts">
import type { MarketplaceRecord, ReviewRecord, SortMode } from '../../composables/useMarketplace'
import type { MarketDuration, MarketGenre, MarketStyle } from '../../utils/marketTaxonomy'
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
  optionsOutline,
  personOutline,
  shareSocialOutline,
  starOutline,
  star as starSolid,
} from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LayoutPage from '../../components/common/LayoutPage.vue'
import MarketPublishModal from '../../components/marketplace/MarketPublishModal.vue'
import { useCloudbase } from '../../composables/useCloudbase'
import { useMarketplace } from '../../composables/useMarketplace'
import { useProjectContent } from '../../composables/useProjectContent'
import { exportProject, importProject } from '../../composables/useProjectExport'
import { useShortLink } from '../../composables/useShortLink'
import { useAuthStore } from '../../stores/useAuthStore'
import { useStudioStore } from '../../stores/useStudioStore'
import { MemoryFsAdapter } from '../../utils/fs/MemoryFsAdapter'
import {
  durationLabelKey,
  genreLabelKey,
  MARKET_DURATIONS,
  MARKET_GENRES,
  MARKET_STYLES,
  styleLabelKey,
} from '../../utils/marketTaxonomy'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const studioStore = useStudioStore()
const { getFs, characters, stats: projectStats } = useProjectContent()
const {
  isBusy,
  browseMarket,
  incrementDownloads,
  submitReview,
  fetchReviews,
  likeReview,
  publishProject,
  setFeatured,
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
const selectedGenre = ref<MarketGenre | null>(null)
const selectedStyle = ref<MarketStyle | null>(null)
const selectedDuration = ref<MarketDuration | null>(null)
const showFilters = ref(false)
const sortMode = ref<SortMode>('newest')
const selectedItem = ref<MarketplaceRecord | null>(null)

// Review state
const reviews = ref<ReviewRecord[]>([])
const reviewRating = ref(5)
const reviewComment = ref('')
const isReviewLoading = ref(false)

// Install state
const isInstalling = ref(false)
const isSharing = ref(false)
const { createShortLink } = useShortLink()

// Publish state
const isPublishing = ref(false)
const showPublishModal = ref(false)
const publishWorldMd = ref('')

const allTags = computed(() => {
  const tags = new Set<string>()
  for (const item of items.value) {
    for (const tag of item.tags)
      tags.add(tag)
  }
  return [...tags]
})

const GENRE_OPTIONS = MARKET_GENRES
const STYLE_OPTIONS = MARKET_STYLES
const DURATION_OPTIONS = MARKET_DURATIONS

const hasActiveFilter = computed(() =>
  !!(selectedGenre.value || selectedStyle.value || selectedDuration.value || searchQuery.value),
)

const activeFilterCount = computed(() =>
  [selectedGenre.value, selectedStyle.value, selectedDuration.value].filter(Boolean).length,
)

const featuredItems = computed(() =>
  items.value.filter(i => i.featured).slice(0, 4),
)

const filteredItems = computed(() => {
  let result = items.value

  // Structured taxonomy filters (genre / style / duration) — client-side over
  // the loaded page so chip taps feel instant without extra round-trips.
  if (selectedGenre.value)
    result = result.filter(i => i.genre === selectedGenre.value)
  if (selectedStyle.value)
    result = result.filter(i => i.style === selectedStyle.value)
  if (selectedDuration.value)
    result = result.filter(i => i.duration === selectedDuration.value)

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(i =>
      i.name.toLowerCase().includes(q)
      || (i.description || '').toLowerCase().includes(q)
      || i.authorName.toLowerCase().includes(q),
    )
  }

  return result
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

async function handleShare() {
  if (!cloudApp || !selectedItem.value)
    return

  isSharing.value = true
  try {
    const shareUrl = `${window.location.origin}/share/${selectedItem.value.projectId}`
    const result = await createShortLink(cloudApp, {
      targetUrl: shareUrl,
      projectId: selectedItem.value.projectId,
      marketId: selectedItem.value._id,
    })
    if (result?.url) {
      await navigator.clipboard.writeText(result.url)
      const toast = await toastController.create({
        message: t('marketplace.shareUrlCopied'),
        duration: 2000,
        color: 'success',
      })
      await toast.present()
    }
  }
  catch {
    const toast = await toastController.create({
      message: t('marketplace.shareFailed'),
      duration: 2000,
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    isSharing.value = false
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

async function openPublishModal() {
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

  // Best-effort read of world.md to give the AI tagger more context.
  publishWorldMd.value = ''
  try {
    const fs = getFs()
    if (fs && await fs.exists('adv/world.md'))
      publishWorldMd.value = await fs.readFile('adv/world.md')
  }
  catch {
    // world.md is optional; tagger falls back to name + description + characters.
  }
  showPublishModal.value = true
}

async function doPublish(payload: {
  tags: string[]
  genre?: MarketGenre
  style?: MarketStyle
  duration: MarketDuration
}) {
  if (!cloudApp || !authStore.isLoggedIn)
    return

  const project = studioStore.currentProject
  if (!project)
    return

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
      tags: payload.tags,
      genre: payload.genre,
      style: payload.style,
      duration: payload.duration,
      stats: realStats,
      version: '1.0.0',
      packageKey: uploadResult.fileID,
      packageSize,
    })

    if (!marketId)
      throw new Error(t('marketplace.publishFailed'))

    showPublishModal.value = false
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

function toggleGenre(id: MarketGenre) {
  selectedGenre.value = selectedGenre.value === id ? null : id
}

function toggleStyle(id: MarketStyle) {
  selectedStyle.value = selectedStyle.value === id ? null : id
}

function toggleDuration(id: MarketDuration) {
  selectedDuration.value = selectedDuration.value === id ? null : id
}

function clearFilters() {
  selectedGenre.value = null
  selectedStyle.value = null
  selectedDuration.value = null
}

const isOwner = computed(() =>
  !!(selectedItem.value && authStore.userInfo.uid && selectedItem.value.ownerId === authStore.userInfo.uid),
)

async function handleToggleFeatured() {
  if (!cloudApp || !selectedItem.value?._id)
    return
  const next = !selectedItem.value.featured
  const ok = await setFeatured(cloudApp, selectedItem.value._id, next)
  if (ok) {
    selectedItem.value.featured = next
    // Keep the loaded list in sync so the Featured row reflects the change.
    const inList = items.value.find(i => i._id === selectedItem.value!._id)
    if (inList)
      inList.featured = next
    const toast = await toastController.create({
      message: next ? t('marketplace.featuredOn') : t('marketplace.featuredOff'),
      duration: 1500,
      position: 'top',
    })
    await toast.present()
  }
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
        type="button"
        class="publish-btn"
        :disabled="isPublishing || !studioStore.currentProject"
        @click="openPublishModal"
      >
        <IonIcon :icon="cloudUploadOutline" />
        {{ t('marketplace.publish') }}
        <IonSpinner v-if="isPublishing" name="dots" />
      </button>
    </div>

    <!-- Filter toggle -->
    <div class="filter-bar">
      <button
        type="button"
        class="filter-toggle"
        :class="{ 'filter-toggle--active': activeFilterCount > 0 }"
        @click="showFilters = !showFilters"
      >
        <IonIcon :icon="optionsOutline" />
        {{ t('marketplace.filters') }}
        <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
      </button>
      <button
        v-if="activeFilterCount > 0"
        type="button"
        class="filter-clear"
        @click="clearFilters"
      >
        {{ t('marketplace.clearFilters') }}
      </button>
    </div>

    <!-- Structured taxonomy filters -->
    <div v-if="showFilters" class="filter-panel">
      <div class="filter-group">
        <span class="filter-group__label">{{ t('marketplace.genreLabel') }}</span>
        <div class="filter-group__chips">
          <IonChip
            v-for="opt in GENRE_OPTIONS"
            :key="opt.id"
            :color="selectedGenre === opt.id ? 'primary' : undefined"
            @click="toggleGenre(opt.id)"
          >
            {{ opt.icon }} {{ t(opt.labelKey) }}
          </IonChip>
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-group__label">{{ t('marketplace.styleLabel') }}</span>
        <div class="filter-group__chips">
          <IonChip
            v-for="opt in STYLE_OPTIONS"
            :key="opt.id"
            :color="selectedStyle === opt.id ? 'primary' : undefined"
            @click="toggleStyle(opt.id)"
          >
            {{ opt.icon }} {{ t(opt.labelKey) }}
          </IonChip>
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-group__label">{{ t('marketplace.durationLabel') }}</span>
        <div class="filter-group__chips">
          <IonChip
            v-for="opt in DURATION_OPTIONS"
            :key="opt.id"
            :color="selectedDuration === opt.id ? 'primary' : undefined"
            @click="toggleDuration(opt.id)"
          >
            {{ opt.icon }} {{ t(opt.labelKey) }}
          </IonChip>
        </div>
      </div>
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

    <!-- Featured section -->
    <div v-if="featuredItems.length > 0 && !hasActiveFilter" class="market-featured">
      <h3 class="market-featured__title">
        ⭐ {{ t('marketplace.featured') }}
      </h3>
      <div class="market-featured__row">
        <button
          v-for="item in featuredItems"
          :key="item._id"
          type="button"
          class="market-card market-card--featured"
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
          </div>
        </button>
      </div>
    </div>

    <!-- Card grid -->
    <div v-if="filteredItems.length > 0" class="market-grid">
      <button
        v-for="item in filteredItems"
        :key="item._id"
        type="button"
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
          <div v-if="item.genre || item.style || item.duration" class="market-card__taxonomy">
            <span v-if="item.genre">{{ t(genreLabelKey(item.genre)) }}</span>
            <span v-if="item.style">{{ t(styleLabelKey(item.style)) }}</span>
            <span v-if="item.duration">{{ t(durationLabelKey(item.duration)) }}</span>
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
    <div v-else-if="!isLoading" class="market-empty">
      <p>{{ t('marketplace.empty') }}</p>
    </div>

    <!-- Detail Modal -->
    <IonModal :is-open="!!selectedItem" @did-dismiss="selectedItem = null">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{{ selectedItem?.name }}</IonTitle>
          <IonButtons slot="end">
            <button type="button" class="market-close-btn" @click="selectedItem = null">
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
          <button type="button" class="market-detail__author-link" @click="navigateToCreator(selectedItem.ownerId)">
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

          <!-- Taxonomy chips (genre / style / duration) -->
          <div
            v-if="selectedItem.genre || selectedItem.style || selectedItem.duration"
            class="market-detail__tags"
          >
            <IonChip v-if="selectedItem.genre" color="primary" @click="toggleGenre(selectedItem.genre); selectedItem = null; showFilters = true">
              {{ t(genreLabelKey(selectedItem.genre)) }}
            </IonChip>
            <IonChip v-if="selectedItem.style" color="primary" @click="toggleStyle(selectedItem.style); selectedItem = null; showFilters = true">
              {{ t(styleLabelKey(selectedItem.style)) }}
            </IonChip>
            <IonChip v-if="selectedItem.duration" color="primary" @click="toggleDuration(selectedItem.duration); selectedItem = null; showFilters = true">
              {{ t(durationLabelKey(selectedItem.duration)) }}
            </IonChip>
          </div>

          <div v-if="selectedItem.tags.length" class="market-detail__tags">
            <IonChip v-for="tag in selectedItem.tags" :key="tag" color="medium">
              {{ tag }}
            </IonChip>
          </div>

          <!-- Install button -->
          <div class="market-detail__actions">
            <button
              type="button"
              class="market-detail__install"
              :disabled="isInstalling || !selectedItem.packageKey"
              @click="handleInstall"
            >
              <IonSpinner v-if="isInstalling" name="dots" />
              <IonIcon v-else :icon="cloudDownloadOutline" />
              {{ isInstalling ? t('marketplace.installing') : t('marketplace.install') }}
            </button>
            <button
              type="button"
              class="market-detail__share"
              :disabled="isSharing"
              @click="handleShare"
            >
              <IonSpinner v-if="isSharing" name="dots" />
              <IonIcon v-else :icon="shareSocialOutline" />
              {{ t('marketplace.share') }}
            </button>
          </div>

          <!-- Owner curation: feature / unfeature -->
          <button
            v-if="isOwner"
            type="button"
            class="market-detail__feature"
            @click="handleToggleFeatured"
          >
            <IonIcon :icon="selectedItem.featured ? starSolid : starOutline" />
            {{ selectedItem.featured ? t('marketplace.unfeature') : t('marketplace.feature') }}
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
                  type="button"
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
                type="button"
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
                  <button type="button" class="review-like-btn" @click="handleLikeReview(review._id!)">
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

    <!-- Publish modal: taxonomy + tags + AI auto-tag -->
    <MarketPublishModal
      :is-open="showPublishModal"
      :project-name="studioStore.currentProject?.name || ''"
      :description="studioStore.currentProject?.description"
      :chapter-count="projectStats.chapters"
      :characters="characters"
      :world-md="publishWorldMd"
      :is-publishing="isPublishing"
      @close="showPublishModal = false"
      @publish="doPublish"
    />
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
  font-size: var(--adv-font-body-sm);
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md) 0;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--adv-radius-sm);
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  cursor: pointer;
}

.filter-toggle--active {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: var(--adv-font-caption);
}

.filter-clear {
  background: none;
  border: none;
  color: var(--adv-text-tertiary);
  font-size: var(--adv-font-body-sm);
  cursor: pointer;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md) 0;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.filter-group__label {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
}

.filter-group__chips {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.market-card__taxonomy {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: var(--adv-space-xs);
}

.market-card__taxonomy span {
  font-size: var(--adv-font-caption);
  color: var(--ion-color-primary);
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-sm);
  padding: 1px 6px;
}

.market-detail__feature {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  margin-top: var(--adv-space-sm);
  padding: 8px 16px;
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  border: 1px solid var(--adv-border-subtle);
  cursor: pointer;
}

.market-featured {
  padding: 0 var(--adv-space-md) var(--adv-space-sm);
}

.market-featured__title {
  font-size: var(--adv-font-body, 14px);
  font-weight: 700;
  margin: 0 0 var(--adv-space-sm);
  color: var(--adv-text-primary);
}

.market-featured__row {
  display: flex;
  gap: var(--adv-space-md);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--adv-space-xs);
}

.market-card--featured {
  min-width: 200px;
  flex-shrink: 0;
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
  font-size: var(--adv-font-display);
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
  font-size: var(--adv-font-caption);
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
  font-size: var(--adv-font-subtitle);
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
  font-size: var(--adv-font-display);
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

.market-detail__actions {
  display: flex;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-md);
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
}

.market-detail__share {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: 12px 24px;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
  font-weight: 600;
  border: 1px solid var(--adv-border-subtle);
  cursor: pointer;
}

.market-detail__install:disabled,
.market-detail__share:disabled {
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
  font-size: var(--adv-font-title);
  color: var(--adv-text-tertiary);
  cursor: pointer;
  padding: 0;
}

.star-btn--active {
  color: var(--adv-accent);
}

.review-submit-btn {
  align-self: flex-end;
  padding: 6px 16px;
  border-radius: var(--adv-radius-sm);
  border: none;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: var(--adv-font-body-sm);
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
  font-size: var(--adv-font-body-sm);
  color: var(--adv-accent);
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
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.review-like-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--adv-text-tertiary);
  font-size: var(--adv-font-caption);
  cursor: pointer;
}

.review-empty {
  text-align: center;
  color: var(--adv-text-tertiary);
  font-size: var(--adv-font-body-sm);
}
</style>
