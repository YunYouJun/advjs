/**
 * Capacitor native plugin initialization.
 *
 * Safe to call on any platform — gracefully no-ops when
 * running in the browser (non-native) environment.
 */

import { Capacitor } from '@capacitor/core'

/**
 * Initialize all Capacitor plugins.
 * Call once after app mount in main.ts.
 */
export async function initCapacitorPlugins() {
  if (!Capacitor.isNativePlatform())
    return

  await initStatusBar()
  await initKeyboard()
}

/**
 * Configure status bar style to match the current theme.
 * Also sets up a MutationObserver to react to dark mode toggling.
 */
async function initStatusBar() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')

    async function applyTheme() {
      const isDark = document.documentElement.classList.contains('dark')
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
      // On Android, make status bar transparent to allow content to draw behind it
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#00000000' })
        await StatusBar.setOverlaysWebView({ overlay: true })
      }
    }

    await applyTheme()

    // Watch for dark mode class changes on <html>
    const observer = new MutationObserver(() => applyTheme())
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }
  catch {
    // StatusBar plugin not available
  }
}

/**
 * Configure keyboard behavior for chat/editor inputs.
 */
async function initKeyboard() {
  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')

    // Resize mode: adjust viewport so content scrolls above keyboard
    await Keyboard.setResizeMode({ mode: KeyboardResize.Ionic })

    // Disable auto-scroll to focused input (Ionic handles this)
    await Keyboard.setScroll({ isDisabled: true })
  }
  catch {
    // Keyboard plugin not available
  }
}

/**
 * Trigger haptic feedback. Safe to call on any platform.
 */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!Capacitor.isNativePlatform())
    return

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')

    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const
    await Haptics.impact({ style: styleMap[style] })
  }
  catch {
    // Haptics not available
  }
}

/**
 * Trigger a haptic notification feedback.
 */
export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!Capacitor.isNativePlatform())
    return

  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')

    const typeMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    } as const
    await Haptics.notification({ type: typeMap[type] })
  }
  catch {
    // Haptics not available
  }
}
