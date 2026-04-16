<script setup lang="ts">
import { IonIcon, toastController } from '@ionic/vue'
import { rocketOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useStudioStore } from '../stores/useStudioStore'
import { quickStartTemplate } from '../utils/projectTemplate'

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const isCreating = ref(false)

async function handleQuickStart() {
  if (isCreating.value)
    return
  isCreating.value = true

  try {
    const projectId = `quickstart-${Date.now()}`
    const projectName = t('projects.quickStart')

    // Create MemoryFsAdapter and bulk-load template files
    const { MemoryFsAdapter } = await import('../utils/fs/MemoryFsAdapter')
    const memFs = new MemoryFsAdapter(projectId)
    await memFs.init()

    const files = quickStartTemplate.files(projectName)
    memFs.bulkLoad(files)
    await memFs.persist()

    // Switch to the new project (no dirHandle → createFsForProject will use MemoryFsAdapter)
    await studioStore.switchProject({
      projectId,
      name: projectName,
      source: 'local',
      description: t('projects.quickStartDesc'),
      lastOpened: Date.now(),
    })

    const toast = await toastController.create({
      message: t('projects.quickStartReady'),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()

    // Navigate to World page so user can start chatting with characters
    router.push('/tabs/world')
  }
  catch {
    const toast = await toastController.create({
      message: t('projects.quickStartFailed'),
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    isCreating.value = false
  }
}
</script>

<template>
  <button
    class="quick-start-btn"
    :disabled="isCreating"
    @click="handleQuickStart"
  >
    <span class="quick-start-btn__icon">
      <IonIcon :icon="rocketOutline" />
    </span>
    <span class="quick-start-btn__text">
      <strong>{{ isCreating ? t('projects.quickStartCreating') : t('projects.quickStart') }}</strong>
      <span>{{ t('projects.quickStartDesc') }}</span>
    </span>
    <span v-if="isCreating" class="quick-start-btn__spinner" />
  </button>
</template>

<style scoped>
.quick-start-btn {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
  width: 100%;
  padding: var(--adv-space-lg);
  border-radius: var(--adv-radius-lg);
  border: 2px solid var(--ion-color-primary);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default),
    background var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

.quick-start-btn:not(:disabled):active {
  transform: scale(0.98);
}

.quick-start-btn:not(:disabled):hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(139, 92, 246, 0.14));
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.quick-start-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.quick-start-btn__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--adv-radius-md);
  background: var(--ion-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 24px;
}

.quick-start-btn__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.quick-start-btn__text strong {
  font-size: var(--adv-font-body);
  font-weight: 700;
  color: var(--ion-color-primary);
}

.quick-start-btn__text span {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}

.quick-start-btn__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: qs-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes qs-spin {
  to {
    transform: rotate(360deg);
  }
}

:root.dark .quick-start-btn {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
}

:root.dark .quick-start-btn:not(:disabled):hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(139, 92, 246, 0.22));
}
</style>
