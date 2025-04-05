import type { Preset } from 'unocss'

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
    shortcuts: [
      [
        'adv-animated-faster',
        'animate-fill-mode-both animate-duration-100',
      ],
      [
        'adv-animated-fast',
        'animate-fill-mode-both animate-duration-$adv-animation-duration-fast',
      ],
      [
        'adv-animated',
        'animate-fill-mode-both animate-duration-$adv-animation-duration',
      ],
      [
        'adv-animated-slow',
        'animate-fill-mode-both animate-duration-$adv-animation-duration-slow',
      ],
      ['font-serif', 'font-$adv-font-serif'],
      ['font-sans', 'font-$adv-font-sans'],
      ['font-mono', 'font-$adv-font-mono'],

      [
        'btn',
        'px-4 py-1 rounded inline-block bg-blue-600 text-white cursor-pointer hover:bg-blue-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50',
      ],
      [
        'icon-btn',
        'inline-flex p-2 cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-blue-600',
      ],
    ],
    safelist: [
      'm-auto',
      'text-left',

      // for cur font size
      'text-xl',
      'text-2xl',
      'text-3xl',
      'text-4xl',

      'grid-cols-1',
      'grid-cols-2',
      'grid-cols-3',

      'i-ri-archive-line',
      'i-ri-folder-2-line',
      'i-ri-price-tag-3-line',
      'i-ri-cloud-line',
    ],
  }
}
