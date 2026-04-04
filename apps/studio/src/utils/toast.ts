import { toastController } from '@ionic/vue'

/**
 * Show an Ionic toast notification.
 */
export async function showToast(message: string, color: string = 'success') {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color,
    position: 'bottom',
  })
  await toast.present()
}
