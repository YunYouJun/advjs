import type { Preset } from 'unocss'

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

export interface PresetAdvOptions {
  debug: boolean
}

export function presetAdv(options: Partial<PresetAdvOptions> = {}): Preset<object> {
  if (options.debug) {
    // eslint-disable-next-line no-console
    console.info('DEBUG MODE')
  }
  return {
    name: '@advjs/unocss',
    shortcuts: themeShortcuts,
    safelist: ['m-auto', 'text-left'],
  }
}
