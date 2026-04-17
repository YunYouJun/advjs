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
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { chatbubbleOutline, openOutline, shareOutline } from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import QRCodeGenerator from '../components/QRCodeGenerator.vue'
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
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic requires native slot -->
        <IonButtons slot="start">
          <IonBackButton default-href="/" />
        </IonButtons>
        <IonTitle>{{ summary?.name || 'Shared Project' }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic requires native slot -->
        <IonButtons slot="end">
          <IonButton fill="clear" @click="handleShare">
            <IonIcon :icon="shareOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
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
        <IonButton router-link="/" fill="outline">
          {{ t('sharePreview.backToStudio') || 'Go to Studio' }}
        </IonButton>
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
          <button class="share-cta__btn" @click="handleOpenInStudio">
            <IonIcon :icon="openOutline" />
            {{ t('sharePreview.openInStudio') || 'Open in Studio' }}
          </button>
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
            <QRCodeGenerator :value="importUrl" :size="180" :show-actions="false" />
          </div>
          <p class="share-qr-hint">
            {{ t('sharePreview.scanHint') || 'QR code points to the import URL for this project' }}
          </p>
        </section>

        <!-- Footer -->
        <footer class="share-footer">
          <span>Created with</span>
          <a href="https://studio.advjs.org" target="_blank" rel="noopener">ADV.JS Studio</a>
        </footer>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.share-loading,
.share-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  gap: 16px;
  color: var(--adv-text-secondary, #64748b);
}

.share-empty__icon {
  font-size: 56px;
  opacity: 0.4;
}

.share-empty h3 {
  margin: 0;
  font-size: 18px;
  color: var(--adv-text-primary, #1a1a2e);
}

.share-empty p {
  max-width: 360px;
  line-height: 1.6;
  font-size: 14px;
  margin: 0;
}

.share-main {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 0 40px;
}

/* ── Hero ── */
.share-hero {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-hero__cover {
  aspect-ratio: 16 / 9;
  background-size: cover;
  background-position: center;
  background-color: linear-gradient(135deg, #8b5cf6, #6366f1);
  border-radius: 12px;
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
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  color: var(--adv-text-primary, #1a1a2e);
}

.share-hero__desc {
  font-size: 15px;
  line-height: 1.6;
  color: var(--adv-text-secondary, #64748b);
  margin: 0;
}

.share-hero__stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--adv-text-tertiary, #94a3b8);
}

/* ── CTA ── */
.share-cta {
  padding: 0 16px 24px;
}

.share-cta__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.share-cta__btn:hover {
  opacity: 0.92;
}

.share-cta__btn:active {
  transform: scale(0.98);
}

/* ── Sections ── */
.share-section {
  padding: 20px 16px;
  border-top: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
}

.share-section--center {
  text-align: center;
}

.share-section__title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
  color: var(--adv-text-primary, #1a1a2e);
}

/* ── Character grid ── */
.share-char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.share-char-card {
  padding: 12px;
  border-radius: 10px;
  background: var(--adv-surface-elevated, #f8fafc);
  text-align: center;
}

.share-char-card__avatar {
  width: 56px;
  height: 56px;
  margin: 0 auto 8px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b5cf6;
  font-size: 22px;
  font-weight: 700;
}

.share-char-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.share-char-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--adv-text-primary, #1a1a2e);
}

.share-char-card__desc {
  font-size: 12px;
  line-height: 1.4;
  color: var(--adv-text-tertiary, #94a3b8);
  margin: 4px 0 0;
}

/* ── Chapter list ── */
.share-chapter-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-chapter-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--adv-surface-elevated, #f8fafc);
  font-size: 14px;
  color: var(--adv-text-secondary, #475569);
}

.share-chapter-list__icon {
  flex-shrink: 0;
  color: #8b5cf6;
  font-size: 16px;
}

/* ── QR Code ── */
.share-qr-box {
  display: inline-block;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.share-qr-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--adv-text-tertiary, #94a3b8);
}

/* ── Footer ── */
.share-footer {
  text-align: center;
  padding: 24px 16px;
  font-size: 12px;
  color: var(--adv-text-tertiary, #94a3b8);
}

.share-footer a {
  color: #8b5cf6;
  font-weight: 600;
  margin-left: 4px;
  text-decoration: none;
}

.share-footer a:hover {
  text-decoration: underline;
}

:root.dark .share-char-card,
:root.dark .share-chapter-list li {
  background: var(--adv-surface-elevated, #252536);
}

:root.dark .share-qr-box {
  background: #f5f5f5;
}
</style>
