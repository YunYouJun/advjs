import { app } from 'electron'
import type { CHANNEL } from '../../../constants'

export const handleMap: Record<CHANNEL, (...args: any[]) => any> = {
  'quit-app': () => app.quit(),
}
