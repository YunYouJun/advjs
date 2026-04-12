<script setup lang="ts">
import {
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { cloudDownloadOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'

const { t } = useI18n()

// --- Mock data ---
interface MarketplaceItem {
  id: string
  title: string
  author: string
  description: string
  tags: string[]
  cover: string
  characters: number
  chapters: number
  downloads: number
  rating: number
}

const mockItems: MarketplaceItem[] = [
  {
    id: 'sakura-academy',
    title: '樱花学院物语',
    author: 'StoryWeaver',
    description: '一个发生在日本高中的青春恋爱故事。丰富的角色互动和多条故事线。',
    tags: ['校园', '恋爱', '日系'],
    cover: '🌸',
    characters: 8,
    chapters: 12,
    downloads: 1240,
    rating: 4.5,
  },
  {
    id: 'cyber-noir',
    title: 'Cyber Noir: Neon City',
    author: 'DarkTale',
    description: 'A cyberpunk detective story set in 2087. Uncover conspiracies in a neon-lit metropolis.',
    tags: ['Cyberpunk', 'Mystery', 'Sci-Fi'],
    cover: '🌃',
    characters: 6,
    chapters: 8,
    downloads: 890,
    rating: 4.7,
  },
  {
    id: 'ancient-realm',
    title: '仙途录',
    author: '墨画生',
    description: '修仙世界的冒险故事。你将在这个充满灵气的世界中修炼、探索、结交伙伴。',
    tags: ['仙侠', '冒险', '奇幻'],
    cover: '⛰️',
    characters: 12,
    chapters: 20,
    downloads: 2100,
    rating: 4.3,
  },
  {
    id: 'haunted-manor',
    title: 'The Haunted Manor',
    author: 'GhostWriter',
    description: 'A horror visual novel where every choice matters. Can you survive the night?',
    tags: ['Horror', 'Thriller', 'Choice'],
    cover: '🏚️',
    characters: 5,
    chapters: 6,
    downloads: 560,
    rating: 4.8,
  },
  {
    id: 'star-voyager',
    title: 'Star Voyager',
    author: 'CosmicDev',
    description: 'Explore the galaxy, manage your crew, and make first contact with alien civilizations.',
    tags: ['Sci-Fi', 'Exploration', 'Management'],
    cover: '🚀',
    characters: 10,
    chapters: 15,
    downloads: 780,
    rating: 4.4,
  },
]

const allTags = computed(() => {
  const tags = new Set<string>()
  for (const item of mockItems) {
    for (const tag of item.tags) {
      tags.add(tag)
    }
  }
  return [...tags]
})

const searchQuery = ref('')
const selectedTag = ref<string | null>(null)
const selectedItem = ref<MarketplaceItem | null>(null)

const filteredItems = computed(() => {
  let result = mockItems
  if (selectedTag.value) {
    result = result.filter(i => i.tags.includes(selectedTag.value!))
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(i =>
      i.title.toLowerCase().includes(q)
      || i.description.toLowerCase().includes(q)
      || i.author.toLowerCase().includes(q),
    )
  }
  return result
})

function formatDownloads(n: number): string {
  if (n >= 1000)
    return `${(n / 1000).toFixed(1)}k`
  return String(n)
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

    <!-- Tag filter chips -->
    <div class="tag-chips">
      <IonChip
        :color="selectedTag === null ? 'primary' : undefined"
        @click="selectedTag = null"
      >
        {{ t('world.timelineFilterAll') }}
      </IonChip>
      <IonChip
        v-for="tag in allTags"
        :key="tag"
        :color="selectedTag === tag ? 'primary' : undefined"
        @click="selectedTag = tag"
      >
        {{ tag }}
      </IonChip>
    </div>

    <!-- Card grid -->
    <div class="market-grid">
      <button
        v-for="item in filteredItems"
        :key="item.id"
        class="market-card"
        @click="selectedItem = item"
      >
        <div class="market-card__cover">
          {{ item.cover }}
        </div>
        <div class="market-card__body">
          <div class="market-card__title">
            {{ item.title }}
          </div>
          <div class="market-card__author">
            {{ item.author }}
          </div>
          <div class="market-card__meta">
            <span>👥 {{ item.characters }}</span>
            <span>📖 {{ item.chapters }}</span>
            <span>⬇️ {{ formatDownloads(item.downloads) }}</span>
            <span>⭐ {{ item.rating }}</span>
          </div>
        </div>
      </button>
    </div>

    <!-- Empty -->
    <div v-if="filteredItems.length === 0" class="market-empty">
      <p>{{ t('marketplace.empty') }}</p>
    </div>

    <!-- Detail Modal -->
    <IonModal :is-open="!!selectedItem" @did-dismiss="selectedItem = null">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{{ selectedItem?.title }}</IonTitle>
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
            {{ selectedItem.cover }}
          </div>
          <h2 class="market-detail__title">
            {{ selectedItem.title }}
          </h2>
          <p class="market-detail__author">
            {{ t('marketplace.by', { author: selectedItem.author }) }}
          </p>
          <p class="market-detail__desc">
            {{ selectedItem.description }}
          </p>
          <div class="market-detail__stats">
            <div class="market-detail__stat">
              <strong>{{ selectedItem.characters }}</strong>
              <span>{{ t('preview.charactersCount') }}</span>
            </div>
            <div class="market-detail__stat">
              <strong>{{ selectedItem.chapters }}</strong>
              <span>{{ t('preview.chaptersCount') }}</span>
            </div>
            <div class="market-detail__stat">
              <strong>{{ formatDownloads(selectedItem.downloads) }}</strong>
              <span>{{ t('marketplace.downloads') }}</span>
            </div>
            <div class="market-detail__stat">
              <strong>⭐ {{ selectedItem.rating }}</strong>
              <span>{{ t('marketplace.rating') }}</span>
            </div>
          </div>
          <div class="market-detail__tags">
            <IonChip v-for="tag in selectedItem.tags" :key="tag" color="medium">
              {{ tag }}
            </IonChip>
          </div>
          <button class="market-detail__install" disabled>
            <IonIcon :icon="cloudDownloadOutline" />
            {{ t('marketplace.install') }}
          </button>
          <p class="market-detail__hint">
            {{ t('marketplace.comingSoon') }}
          </p>
        </div>
      </IonContent>
    </IonModal>
  </LayoutPage>
</template>

<style scoped>
.tag-chips {
  display: flex;
  gap: 4px;
  padding: var(--adv-space-sm) var(--adv-space-md);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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
  font-size: 40px;
  background: var(--adv-gradient-surface);
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
  font-size: 64px;
  margin-bottom: var(--adv-space-sm);
}

.market-detail__title {
  font-size: var(--adv-font-subtitle, 18px);
  font-weight: 700;
  margin: 0;
}

.market-detail__author {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
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
  opacity: 0.5;
}

.market-detail__hint {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}
</style>
