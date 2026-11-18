import { alertController } from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import { commitStudioContentSource, isStudioContentConflict, readStudioContentSource } from '../utils/projectContentMutation'
import { getCurrentProjectId } from '../utils/projectScope'
import { showToast } from '../utils/toast'
import { useProjectContent } from './useProjectContent'

/**
 * Composable for deleting content files with confirmation.
 */
export function useContentDelete() {
  const { t } = useI18n()
  const { getFs, reload } = useProjectContent()

  /**
   * Delete a file from the project directory after user confirmation.
   * @param filePath - relative path inside the project directory (e.g. "adv/chapters/ch01.adv.md")
   * @param confirmMessage - message displayed in the confirmation alert
   * @returns true if file was deleted
   */
  async function deleteFile(filePath: string, confirmMessage: string): Promise<boolean> {
    const fs = getFs()
    const projectId = getCurrentProjectId()
    if (!fs) {
      await showToast(t('contentEditor.saveFailed', { error: 'No file system' }), 'danger')
      return false
    }
    const assertCurrent = () => {
      if (getFs() !== fs || getCurrentProjectId() !== projectId)
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    }
    try {
      const source = await readStudioContentSource(fs, filePath, assertCurrent)
      if (source.content === null)
        throw new Error('ADV_STUDIO_CONTENT_MISSING')
      const alert = await alertController.create({
        header: t('common.confirmDelete'),
        message: confirmMessage,
        buttons: [
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('common.delete'),
            role: 'destructive',
          },
        ],
      })
      await alert.present()
      const { role } = await alert.onDidDismiss()
      if (role !== 'destructive')
        return false
      await commitStudioContentSource(source, null, assertCurrent)
      await reload()
      await showToast(t('common.deleted'))
      return true
    }
    catch (err) {
      await showToast(isStudioContentConflict(err) ? t('contentEditor.fileChanged') : t('contentEditor.saveFailed', { error: String(err) }), 'danger')
      return false
    }
  }

  return { deleteFile }
}
