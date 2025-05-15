import type { Menu } from '@advjs/gui'
import { Toast } from '@advjs/gui'

import qrcode from 'qrcode'
import { links } from '../../../../../packages/shared/src'

export function useEditorMenubar() {
  const fileStore = useFileStore()
  const dialogStore = useDialogStore()

  const { copy, copied } = useClipboard()
  const clipboardItems = useClipboardItems()

  const menus: Menu[] = [
    {
      name: 'ADV.JS',
      class: 'font-bold!',
      items: [
        {
          label: 'About ADV.JS',
          ellipsis: true,
          onClick: () => {
            dialogStore.openStates.about = true
          },
        },
        {
          label: 'Settings',
          ellipsis: true,
          onClick: () => {

          },
        },
      ],
    },
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
      name: 'Edit',
      items: [
        {
          label: 'Undo',
          accelerator: '⌘ Z',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Undo')
          },
        },
        {
          label: 'Redo',
          accelerator: '⇧ ⌘ Z',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Redo')
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Cut',
          accelerator: '⌘ X',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Cut')
          },
        },
        {
          label: 'Copy',
          accelerator: '⌘ C',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Copy')
          },
        },
        {
          label: 'Paste',
          accelerator: '⌘ V',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Paste')
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Project Settings',
          onClick: () => {
            dialogStore.openStates.settings = true
          },
        },
      ],
    },
    {
      name: 'View',
      items: [
        {
          label: 'Command Palette',
          ellipsis: true,
          accelerator: '⇧ ⌘ P',
        },
        { type: 'separator' },
        {
          label: 'Chat',
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: '⌘ R',
          onClick: () => {
            window.location.reload()
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          onClick: () => {
            // page fullscreen
            if (document.fullscreenElement) {
              document.exitFullscreen()
            }
            else {
              document.documentElement.requestFullscreen()
            }
          },
        },
      ],
    },
    {
      name: 'Window',
      items: [
        {
          type: 'submenu',
          label: 'Layouts',
          children: [
            {
              label: 'Reset Layout',
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Package Manager',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Package Manager')
          },
        },
      ],
    },
    {
      name: 'Services',
      items: [
        {
          label: 'CDN',
          type: 'submenu',
          children: [
            {
              type: 'normal',
              label: 'Tencent COS',
              onClick: () => {
                dialogStore.openStates.settings = true
              },
            },
            {
              type: 'normal',
              label: 'AWS S3',
              onClick: () => {
                // dialogStore.settingsDialogOpen = true
              },
            },
          ],
        },
      ],
    },
    {
      name: 'Help',
      items: [
        {
          label: 'Documentation',
          onClick: () => {
            window.open('https://docs.advjs.org')
          },
        },
        {
          label: 'Report Issues',
          onClick: () => {
            window.open(links.issues)
          },
        },
        {
          label: 'Release Notes',
          onClick: () => {
            window.open(links.releases)
          },
        },
        {
          label: 'Source Code',
          onClick: () => {
            window.open(links.github)
          },
        },
        { type: 'separator' },
        {
          label: 'Join Discord',
          onClick: () => {
            window.open(links.discord)
          },
        },
        {
          label: 'Discuss on GitHub',
          onClick: () => {
            window.open(links.discussions)
          },
        },
        {
          label: 'Ask @YunYouJun',
          onClick: () => {
            window.open(links.twitter)
          },
        },
      ],
    },
  ]

  return {
    menus,
  }
}
