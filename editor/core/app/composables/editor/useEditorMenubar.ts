import type { Menu } from '@advjs/gui'
import { Toast } from '@advjs/gui'

import qrcode from 'qrcode'
import { PROJECT_TEMPLATES } from '~/composables/useCreateProject'
import { links } from '../../../../../packages/shared/src'

export function useEditorMenubar() {
  const { t } = useI18n()
  const fileStore = useFileStore()
  const dialogStore = useDialogStore()
  const router = useRouter()

  const { copy, copied } = useClipboard()
  const clipboardItems = useClipboardItems()

  const { createAndLoadProject } = useCreateProject()
  const { recentProjects } = useRecentProjects()

  /**
   * open adv project by triggering the explorer's open directory button
   */
  function openAdvProject() {
    const advExplorerDom = document.querySelector('#adv-explorer')
    const openDirBtn = advExplorerDom?.querySelector('.agui-open-directory') as HTMLElement
    if (openDirBtn) {
      openDirBtn.click()
    }
  }

  const menus = computed<Menu[]>(() => [
    {
      name: 'ADV.JS',
      class: 'font-bold!',
      items: [
        {
          label: t('menu.about'),
          ellipsis: true,
          onClick: () => {
            dialogStore.openStates.about = true
          },
        },
        {
          label: t('menu.settings'),
          ellipsis: true,
          onClick: () => {
            dialogStore.openStates.preferences = true
          },
        },
      ],
    },
    {
      name: t('menu.file'),
      items: [
        {
          type: 'submenu',
          label: t('menu.newProject'),
          children: PROJECT_TEMPLATES.map(tpl => ({
            label: tpl.name,
            onClick: () => {
              createAndLoadProject(tpl.id)
            },
          })),
        },
        {
          label: t('menu.openLocalProject'),
          onClick: () => {
            openAdvProject()
          },
        },
        {
          type: 'submenu',
          label: t('menu.recentProjects'),
          children: recentProjects.value.length > 0
            ? recentProjects.value.map(project => ({
                label: project.name,
                onClick: async () => {
                  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
                  const projectStore = useProjectStore()
                  const { addRecentProject } = useRecentProjects()

                  projectStore.rootDir = {
                    name: dirHandle.name,
                    kind: 'directory',
                    handle: dirHandle,
                  } as any

                  try {
                    const configHandle = await dirHandle.getFileHandle('adv.config.json')
                    await projectStore.setAdvConfigFileHandle(configHandle)
                  }
                  catch {
                    // no config file
                  }

                  try {
                    const entryHandle = await dirHandle.getFileHandle('index.adv.json')
                    await projectStore.setEntryFileHandle(entryHandle)
                  }
                  catch {
                    // no entry file
                  }

                  addRecentProject({
                    name: dirHandle.name,
                    templateId: project.templateId,
                  })
                },
              }))
            : [{
                label: t('menu.noRecentProjects'),
                disabled: true,
              }],
        },

        {
          type: 'separator',
        },
        {
          label: t('menu.newConfigFile'),
          accelerator: '⌘ N',
        },

        {
          label: t('menu.openConfigFile'),
          onClick: async () => {
            fileStore.openAdvConfigFile()
          },
        },
        {
          label: t('menu.openOnlineConfigFile'),
          onClick: async () => {
            fileStore.onlineAdvConfigFileDialogOpen = true
          },
        },

        {
          type: 'separator',
        },
        {
          type: 'submenu',
          label: t('menu.share'),
          children: [
            {
              label: t('menu.copyMessages'),
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
              label: t('menu.copyLink'),
              onClick: async () => {
                const playLink = new URL(window.location.href)
                // path
                playLink.pathname = '/play'
                // todo modify as online link
                playLink.searchParams.set('url', 'https://cos.advjs.yunle.fun/games/the-lord-of-the-rings/index.adv.json')
                playLink.searchParams.set('adapter', 'pominis')
                await copy(playLink.toString())

                if (copied.value) {
                  Toast({
                    title: 'Link copied to clipboard',
                    description: '',
                    type: 'success',
                    duration: 3000,
                  })
                }
              },
            },
            {
              label: t('menu.copyQRCode'),
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
      name: t('menu.edit'),
      items: [
        {
          label: t('menu.undo'),
          accelerator: '⌘ Z',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Undo')
          },
        },
        {
          label: t('menu.redo'),
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
          label: t('menu.cut'),
          accelerator: '⌘ X',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Cut')
          },
        },
        {
          label: t('menu.copy'),
          accelerator: '⌘ C',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Copy')
          },
        },
        {
          label: t('menu.paste'),
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
          label: t('menu.projectSettings'),
          onClick: () => {
            dialogStore.openStates.settings = true
          },
        },
        {
          type: 'separator',
        },
        {
          label: `${t('menu.preferences')}...`,
          accelerator: '⌘ ,',
          onClick: () => {
            dialogStore.openStates.preferences = true
          },
        },
      ],
    },
    {
      name: t('menu.story'),
      items: [
        {
          type: 'submenu',
          label: t('menu.create'),
          children: [
            {
              label: t('menu.createWorldview'),
              onClick: () => {
                // TODO: open worldview creation dialog
              },
            },
            {
              label: t('menu.createScene'),
              onClick: () => {
                // TODO: open scene creation dialog
              },
            },
            {
              label: t('menu.createCharacter'),
              onClick: () => {
                router.push('/characters')
              },
            },
            { type: 'separator' },
            {
              label: t('menu.createChapter'),
              onClick: () => {
                // TODO: open chapter creation dialog
              },
            },
            {
              label: t('menu.createDialogue'),
              onClick: () => {
                // TODO: open dialogue creation dialog
              },
            },
            {
              label: t('menu.createChoice'),
              onClick: () => {
                // TODO: open choice creation dialog
              },
            },
            { type: 'separator' },
            {
              label: t('menu.createMusic'),
              onClick: () => {
                // TODO: open music creation dialog
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('menu.characters'),
          onClick: () => {
            router.push('/characters')
          },
        },
      ],
    },
    {
      name: t('menu.view'),
      items: [
        {
          label: t('menu.commandPalette'),
          ellipsis: true,
          accelerator: '⇧ ⌘ P',
        },
        { type: 'separator' },
        {
          label: t('menu.characters'),
          onClick: () => {
            router.push('/characters')
          },
        },
        {
          label: t('menu.chat'),
        },
        { type: 'separator' },
        {
          label: t('menu.reload'),
          accelerator: '⌘ R',
          onClick: () => {
            window.location.reload()
          },
        },
        { type: 'separator' },
        {
          label: t('menu.toggleFullscreen'),
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
      name: t('menu.window'),
      items: [
        {
          type: 'submenu',
          label: t('menu.layouts'),
          children: [
            {
              label: t('menu.resetLayout'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('menu.packageManager'),
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('Package Manager')
          },
        },
      ],
    },
    {
      name: t('menu.services'),
      items: [
        {
          label: t('menu.cdn'),
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
      name: t('menu.help'),
      items: [
        {
          label: t('menu.documentation'),
          onClick: () => {
            window.open('https://docs.advjs.org')
          },
        },
        {
          label: t('menu.reportIssues'),
          onClick: () => {
            window.open(links.issues)
          },
        },
        {
          label: t('menu.releaseNotes'),
          onClick: () => {
            window.open(links.releases)
          },
        },
        {
          label: t('menu.sourceCode'),
          onClick: () => {
            window.open(links.github)
          },
        },
        { type: 'separator' },
        {
          label: t('menu.joinDiscord'),
          onClick: () => {
            window.open(links.discord)
          },
        },
        {
          label: t('menu.discussOnGitHub'),
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
  ])

  return {
    menus,
  }
}
