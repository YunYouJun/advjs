<script setup lang="ts">
/**
 * Project share page — read-only preview of a project.
 *
 * Route: `/share/:projectId`
 *
 * Renders project metadata (name, cover, description, character cards, chapter list)
 * using whatever data the current device has for that projectId. Designed to be:
 * 1. Crawler-friendly (OG meta tags injected)
 * 2. Share-friendly (QR code for handoff)
 * 3. Low-friction re-entry (one-click "Open in Studio" button)
 *
 * This page works without a backend: it uses the locally-persisted project data
 * (IndexedDB + localStorage) for the given projectId. When viewed from another
 * device, it gracefully degrades to a placeholder with basic branding.
 */
import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd } from '@advjs/parser'
import {
  IonButton,
  IonIcon,
} from '@ionic/vue'
import { chatbubbleOutline, linkOutline, openOutline, shareOutline } from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import LayoutPage from '../components/common/LayoutPage.vue'
import QRCodeGenerator from '../components/QRCodeGenerator.vue'
import SButton from '../components/ui/SButton.vue'
import { useShortLink } from '../composables/useShortLink'
import { createFileSystem } from '../utils/fs'
import { buildImportUrl, setProjectOgMeta } from '../utils/ogMeta'
import { showToast } from '../utils/toast'

interface ShareProjectSummary {
  projectId: string
  name: string
  description?: string
  cover?: string
  characters: AdvCharacter[]
  chapterFiles: string[]
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const isLoading = ref(true)
const notFound = ref(false)
const summary = ref<ShareProjectSummary | null>(null)

const projectId = computed(() => (route.params.projectId as string) || '')
const shareUrl = computed(() => window.location.href)
const importUrl = computed(() => buildImportUrl(projectId.value))

// Short link integration
const { isCreating: isCreatingShortLink, createShortLink } = useShortLink()
const shortUrl = ref<string | null>(null)

let cloudApp: any = null
try {
  const { useCloudbase } = await import('../composables/useCloudbase')
  cloudApp = useCloudbase().app
}
catch {
  // CloudBase not configured
}

const qrValue = computed(() => shortUrl.value || importUrl.value)

async function handleGenerateShortLink() {
  if (!cloudApp || !summary.value)
    return
  const result = await createShortLink(cloudApp, {
    targetUrl: shareUrl.value,
    projectId: projectId.value,
  })
  if (result) {
    shortUrl.value = result.url
    showToast(t('sharePreview.shortLinkReady'))
  }
}

async function handleCopyShortLink() {
  if (!shortUrl.value)
    return
  await navigator.clipboard.writeText(shortUrl.value)
  showToast(t('sharePreview.linkCopied'))
}

onMounted(async () => {
  if (!projectId.value) {
    notFound.value = true
    isLoading.value = false
    return
  }
  await loadProjectSummary(projectId.value)
})

async function loadProjectSummary(pid: string) {
  try {
    // 1. Read project metadata from localStorage
    const savedProjects = localStorage.getItem('advjs-studio-projects')
    if (!savedProjects) {
      notFound.value = true
      return
    }

    const projects = JSON.parse(savedProjects) as Array<{
      projectId: string
      name: string
      description?: string
      cover?: string
    }>
    const project = projects.find(p => p.projectId === pid)
    if (!project) {
      notFound.value = true
      return
    }

    // 2. Inject OG meta early so crawlers see the right preview
    setProjectOgMeta({
      title: `${project.name} — ADV.JS Studio`,
      description: project.description || `A visual novel project on ADV.JS Studio`,
      image: project.cover,
      url: shareUrl.value,
      type: 'article',
    })

    // 3. Attempt to load characters + chapter list via MemoryFs (if project data is local)
    const characters: AdvCharacter[] = []
    const chapterFiles: string[] = []
    try {
      const fs = await createFileSystem({ projectId: pid })
      const charPaths = await fs.listFiles('adv/characters', '.character.md')
      for (const relPath of charPaths) {
        try {
          const content = await fs.readFile(relPath)
          const parsed = parseCharacterMd(content)
          characters.push(parsed)
        }
        catch {
          // Skip unparseable characters
        }
      }
      const chapters = await fs.listFiles('adv/chapters', '.adv.md')
      chapterFiles.push(...chapters.map(p => p.split('/').pop() || p))
    }
    catch {
      // MemoryFs not available or empty — that's OK, still show project metadata
    }

    summary.value = {
      projectId: pid,
      name: project.name,
      description: project.description,
      cover: project.cover,
      characters,
      chapterFiles,
    }
  }
  catch (err) {
    console.error('[ProjectSharePage] load failed:', err)
    notFound.value = true
  }
  finally {
    isLoading.value = false
  }
}

function handleOpenInStudio() {
  // Navigate to the main app, which will auto-restore this project
  router.push(`/?import=${encodeURIComponent(projectId.value)}`)
}

async function handleShare() {
  const url = shareUrl.value
  if (navigator.share) {
    try {
      await navigator.share({
        title: summary.value?.name || 'ADV.JS Studio',
        text: summary.value?.description,
        url,
      })
    }
    catch {
      // User canceled
    }
  }
  else {
    await navigator.clipboard.writeText(url)
    showToast(t('sharePreview.linkCopied') || 'Link copied')
  }
}
</script>

<template>
  <LayoutPage :title="summary?.name || 'Shared Project'" show-back-button default-href="/">
    <template #end>
      <IonButton fill="clear" @click="handleShare">
        <IonIcon :icon="shareOutline" />
      </IonButton>
    </template>
    <!-- Loading -->
    <div v-if="isLoading" class="share-loading">
      {{ t('sharePreview.loading') || 'Loading preview...' }}
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="share-empty">
      <div class="share-empty__icon">
        📭
      </div>
      <h3>{{ t('sharePreview.notFoundTitle') || 'Project not available on this device' }}</h3>
      <p>
        {{ t('sharePreview.notFoundDesc') || 'The project data is stored locally per device. The creator can export it as .advpkg to share across devices.' }}
      </p>
      <SButton variant="outline" @click="router.push('/')">
        {{ t('sharePreview.backToStudio') || 'Go to Studio' }}
      </SButton>
    </div>

    <!-- Preview -->
    <div v-else-if="summary" class="share-main">
      <!-- Hero -->
      <header class="share-hero">
        <div
          class="share-hero__cover"
          :style="summary.cover ? { backgroundImage: `url(${summary.cover})` } : {}"
        >
          <div v-if="!summary.cover" class="share-hero__placeholder">
            📖
          </div>
        </div>
        <div class="share-hero__meta">
          <h1 class="share-hero__title">
            {{ summary.name }}
          </h1>
          <p v-if="summary.description" class="share-hero__desc">
            {{ summary.description }}
          </p>
          <div class="share-hero__stats">
            <span>👥 {{ summary.characters.length }} {{ t('sharePreview.characters') || 'Characters' }}</span>
            <span>📄 {{ summary.chapterFiles.length }} {{ t('sharePreview.chapters') || 'Chapters' }}</span>
          </div>
        </div>
      </header>

      <!-- Primary CTA -->
      <div class="share-cta">
        <SButton variant="primary" block @click="handleOpenInStudio">
          <IonIcon :icon="openOutline" />
          {{ t('sharePreview.openInStudio') || 'Open in Studio' }}
        </SButton>
      </div>

      <!-- Characters -->
      <section v-if="summary.characters.length > 0" class="share-section">
        <h2 class="share-section__title">
          {{ t('sharePreview.charactersTitle') || 'Characters' }}
        </h2>
        <div class="share-char-grid">
          <div
            v-for="c in summary.characters.slice(0, 12)"
            :key="c.id"
            class="share-char-card"
          >
            <div class="share-char-card__avatar">
              <img v-if="c.avatar" :src="c.avatar" :alt="c.name">
              <span v-else>{{ (c.name || c.id || '?').slice(0, 1) }}</span>
            </div>
            <div class="share-char-card__name">
              {{ c.name }}
            </div>
            <p v-if="c.personality" class="share-char-card__desc">
              {{ c.personality.slice(0, 40) }}{{ c.personality.length > 40 ? '…' : '' }}
            </p>
          </div>
        </div>
      </section>

      <!-- Chapters -->
      <section v-if="summary.chapterFiles.length > 0" class="share-section">
        <h2 class="share-section__title">
          {{ t('sharePreview.chaptersTitle') || 'Chapters' }}
        </h2>
        <ol class="share-chapter-list">
          <li v-for="file in summary.chapterFiles.slice(0, 20)" :key="file">
            <IonIcon :icon="chatbubbleOutline" class="share-chapter-list__icon" />
            {{ file.replace(/\.adv\.md$/, '') }}
          </li>
        </ol>
      </section>

      <!-- QR Code + share -->
      <section class="share-section share-section--center">
        <h2 class="share-section__title">
          {{ t('sharePreview.scanTitle') || 'Scan to Open on Another Device' }}
        </h2>
        <div class="share-qr-box">
          <QRCodeGenerator :value="qrValue" :size="180" :show-actions="false" />
        </div>
        <p class="share-qr-hint">
          {{ t('sharePreview.scanHint') || 'QR code points to the import URL for this project' }}
        </p>

        <!-- Short link generation -->
        <div v-if="cloudApp" class="share-shortlink">
          <template v-if="shortUrl">
            <div class="share-shortlink__url">
              {{ shortUrl }}
            </div>
            <SButton variant="ghost" size="sm" @click="handleCopyShortLink">
              <IonIcon :icon="linkOutline" />
              {{ t('sharePreview.copyShortLink') }}
            </SButton>
          </template>
          <SButton
            v-else
            variant="outline"
            size="sm"
            :disabled="isCreatingShortLink"
            @click="handleGenerateShortLink"
          >
            <IonIcon :icon="linkOutline" />
            {{ t('sharePreview.generateShortLink') }}
          </SButton>
        </div>
      </section>

      <!-- Footer -->
      <footer class="share-footer">
        <span>Created with</span>
        <a href="https://studio.advjs.org" target="_blank" rel="noopener">ADV.JS Studio</a>
      </footer>
    </div>
  </LayoutPage>
</template>

<style scoped>
.share-loading,
.share-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  gap: var(--adv-space-md);
  color: var(--adv-text-secondary);
}

.share-empty__icon {
  font-size: 56px;
  opacity: 0.4;
}

.share-empty h3 {
  margin: 0;
  font-size: var(--adv-font-subtitle);
  color: var(--adv-text-primary);
}

.share-empty p {
  max-width: 360px;
  line-height: 1.6;
  font-size: var(--adv-font-body-sm);
  margin: 0;
}

.share-main {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 0 var(--adv-space-xl);
}

/* ── Hero ── */
.share-hero {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.share-hero__cover {
  aspect-ratio: 16 / 9;
  background-size: cover;
  background-position: center;
  background: var(--adv-gradient-primary);
  border-radius: var(--adv-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.share-hero__placeholder {
  font-size: 72px;
  opacity: 0.3;
}

.share-hero__title {
  font-size: var(--adv-font-display);
  font-weight: 800;
  margin: 0;
  color: var(--adv-text-primary);
}

.share-hero__desc {
  font-size: var(--adv-font-body);
  line-height: 1.6;
  color: var(--adv-text-secondary);
  margin: 0;
}

.share-hero__stats {
  display: flex;
  gap: var(--adv-space-md);
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
}

/* ── CTA ── */
.share-cta {
  padding: 0 var(--adv-space-md) var(--adv-space-lg);
}

/* ── Sections ── */
.share-section {
  padding: var(--adv-space-md);
  border-top: 1px solid var(--adv-border-subtle);
}

.share-section--center {
  text-align: center;
}

.share-section__title {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  margin: 0 0 var(--adv-space-md);
  color: var(--adv-text-primary);
}

/* ── Character grid ── */
.share-char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--adv-space-sm);
}

.share-char-card {
  padding: var(--adv-space-sm);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
  text-align: center;
}

.share-char-card__avatar {
  width: 56px;
  height: 56px;
  margin: 0 auto var(--adv-space-sm);
  border-radius: 50%;
  overflow: hidden;
  background: var(--adv-gradient-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--adv-primary);
  font-size: var(--adv-font-lg);
  font-weight: 700;
}

.share-char-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.share-char-card__name {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.share-char-card__desc {
  font-size: var(--adv-font-body-sm);
  line-height: 1.4;
  color: var(--adv-text-tertiary);
  margin: var(--adv-space-xs) 0 0;
}

/* ── Chapter list ── */
.share-chapter-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.share-chapter-list li {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-elevated);
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}

.share-chapter-list__icon {
  flex-shrink: 0;
  color: var(--adv-primary);
  font-size: var(--adv-font-body);
}

/* ── QR Code ── */
.share-qr-box {
  display: inline-block;
  padding: var(--adv-space-sm);
  background: #fff;
  border-radius: var(--adv-radius-md);
  box-shadow: var(--adv-shadow-card);
}

.share-qr-hint {
  margin: var(--adv-space-sm) 0 0;
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
}

.share-shortlink {
  margin-top: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-sm);
}

.share-shortlink__url {
  padding: var(--adv-space-sm) var(--adv-space-md);
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-sm);
  font-family: monospace;
  font-size: var(--adv-font-body-sm);
  color: var(--adv-primary);
  user-select: all;
}

/* ── Footer ── */
.share-footer {
  text-align: center;
  padding: var(--adv-space-lg) var(--adv-space-md);
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
}

.share-footer a {
  color: var(--adv-primary);
  font-weight: 600;
  margin-left: 4px;
  text-decoration: none;
}

.share-footer a:hover {
  text-decoration: underline;
}

:root.dark .share-char-card,
:root.dark .share-chapter-list li {
  background: var(--adv-surface-elevated);
}

:root.dark .share-qr-box {
  background: #f5f5f5;
}
</style>
