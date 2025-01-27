import type { CHANNEL } from '../../../constants'
import { app } from 'electron'

export const handleMap: Record<CHANNEL, (...args: any[]) => any> = {
  'quit-app': () => app.quit(),
}
