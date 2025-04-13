<script lang="ts" setup>
import type { Menu } from '@advjs/gui'
import { Toast } from '@advjs/gui'

import qrcode from 'qrcode'

const fileStore = useFileStore()
const dialogStore = useDialogStore()

const { copy, copied } = useClipboard()
const clipboardItems = useClipboardItems()

const menus: Menu[] = [
  {
    name: 'File',
    items: [
      {
        label: 'New ADV Config File',
        accelerator: '⌘ N',
      },

      {
        label: 'Open ADV Config File',
        onClick: async () => {
          fileStore.openAdvConfigFile()
        },
      },
      {
        label: 'Open Online ADV Config File',
        onClick: async () => {
          fileStore.onlineAdvConfigFileDialogOpen = true
        },
      },

      {
        type: 'separator',
      },
      {
        type: 'submenu',
        label: 'Share...',
        children: [
          {
            label: 'Copy Messages',
            onClick: async () => {
              const messages = [
                '在线体验我的 ADV 游戏',
                'https://editor.advjs.org',
              ]
              await copy(messages.join('\n'))
              if (copied.value) {
                Toast({
                  title: 'Copied to clipboard',
                  description: messages.join('\n'),
                  type: 'success',
                })
              }
            },
          },
          {
            label: 'Copy Link',
            onClick: async () => {
              await copy('https://editor.advjs.org')
              if (copied.value) {
                Toast({
                  title: 'Link copied to clipboard',
                  description: '',
                  type: 'success',
                  duration: 99999,
                })
              }
            },
          },
          {
            label: 'Copy QR Code',
            onClick: async () => {
              // copy qrcode img
              qrcode.toDataURL('https://editor.advjs.org', {
                type: 'image/png',
                margin: 1,
                scale: 5,
              }).then(async (url) => {
                const blob = await fetch(url).then(res => res.blob())
                await clipboardItems.copy([
                  new ClipboardItem({
                    'image/png': blob,
                  }),
                ])
                if (clipboardItems.copied) {
                  Toast({
                    title: 'QR Code copied to clipboard',
                    description: '',
                    type: 'success',
                  })
                }
              })
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Window',
    items: [
      {
        type: 'checkbox',
        label: 'Show Full URLs',
        accelerator: 'CmdOrCtrl+Shift+U',
        checked: true,
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('Show Full URLs')
        },
      },
    ],
  },
  {
    name: 'Settings',
    items: [
      {
        type: 'normal',
        label: 'Tencent COS',
        onClick: () => {
          dialogStore.settingsDialogOpen = true
        },
      },
    ],
  },
]
</script>

<template>
  <AGUIMenubar :menus="menus" />

  <AESettingsDialog />
</template>
