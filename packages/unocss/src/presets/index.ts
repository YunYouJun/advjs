import type { Preset, PresetOptions } from 'unocss'
import { defu } from 'defu'

const themeShortcuts: Exclude<Preset['shortcuts'], undefined> = [
  [
    'btn',
    'px-4 py-1 rounded inline-block bg-blue-600 text-white cursor-pointer hover:bg-blue-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50',
  ],
  [
    'icon-btn',
    'inline-flex p-2 cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-blue-600',
  ],
]

export function presetAdv(options: PresetOptions = {}): Preset {
  const shortcuts = options.shortcutOverrides ? (defu(options.shortcutOverrides, themeShortcuts) as Preset['shortcuts']) : themeShortcuts

  return {
    name: '@advjs/unocss',
    shortcuts,
    safelist: ['m-auto', 'text-left'],
  }
}
