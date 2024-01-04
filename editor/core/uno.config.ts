import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

const safelist: string[] = [
  'i-vscode-icons-default-file',
  'i-vscode-icons-default-folder',
  'i-vscode-icons-file-type-image',
  'i-vscode-icons-file-type-video',
  'i-vscode-icons-file-type-audio',
  'i-vscode-icons-file-type-pdf2',
  'i-vscode-icons-file-type-word',
  'i-vscode-icons-file-type-excel',
  'i-vscode-icons-file-type-powerpoint',
  'i-vscode-icons-file-type-zip',
  'i-vscode-icons-file-type-markdown',
  'i-vscode-icons-file-type-json',
  'i-vscode-icons-file-type-text',

  'i-vscode-icons-file-type-vue',
  'i-vscode-icons-file-type-js',
  'i-vscode-icons-file-type-typescript',
  'i-vscode-icons-file-type-css',
  'i-vscode-icons-file-type-html',
  'i-vscode-icons-file-type-yaml',
]

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist,
})
