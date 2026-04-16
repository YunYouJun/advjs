import { alertController } from '@ionic/vue'
import { useI18n } from 'vue-i18n'
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
    if (role === 'cancel' || role === 'backdrop')
      return false

    const fs = getFs()
    if (!fs) {
      await showToast(t('contentEditor.saveFailed', { error: 'No file system' }), 'danger')
      return false
    }

    try {
      await fs.deleteFile(filePath)

      await reload()
      await showToast(t('common.deleted'))
      return true
    }
    catch (err) {
      await showToast(t('contentEditor.saveFailed', { error: String(err) }), 'danger')
      return false
    }
  }

  return { deleteFile }
}
