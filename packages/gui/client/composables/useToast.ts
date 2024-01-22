import { ref } from 'vue'
import type AGUIToast from '../components/toast/AGUIToast.vue'

export const toastRef = ref<InstanceType<typeof AGUIToast>>()
export const AGUIToastRef = toastRef

export interface ToastOptions {
  title: string
  description: string
  duration?: number
  type?: 'info' | 'success' | 'warning' | 'error' | 'default'
}

export function Toast(options: ToastOptions) {
  toastRef.value?.add(options)
}
