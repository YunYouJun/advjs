import type { DefaultTheme } from 'vitepress'
import { defineConfig } from 'vitepress'

import { withMermaid } from 'vitepress-plugin-mermaid'
// todo: // wait released https://github.com/vitejs/vite/pull/10254
// import { customElements } from '../../packages/advjs/node/constants'
import typedocSidebar from '../../api/typedoc-sidebar.json'
import { metaData } from './constants'

import head from './head'

const customElements = new Set(['font'])

const nav: DefaultTheme.Config['nav'] = [
  { text: '指南', link: '/guide/' },
  // { text: 'API', link: 'https://api.docs.advjs.org' },
  { text: 'API', link: '/api/' },
  {
    text: 'AGUI',
    link: '/agui/',
  },
  {
    text: '贡献',
    link: '/contributing/',
  },
  {
    text: '关于',
    items: [
      {
        text: 'ADV.JS',
        link: '/about/index',
      },
      {
        text: '设计',
        link: '/about/design/',
      },
      {
        text: '开发',
        link: '/about/dev/',
      },
      {
        text: '设想',
        link: '/about/future/',
      },
    ],
  },
  {
    text: '资源',
    items: [
      {
        text: '案例',
        link: '/resources/showcases',
      },
      {
        text: '学习资源',
        link: '/resources/learning',
      },
    ],
  },
  {
    text: '生态',
    items: [
      {
        text: '总览',
        link: '/ecosystem/',
      },
      {
        text: '工具',
        items: [
          {
            text: '剧本解析器',
            link: 'https://parser.advjs.org',
          },
          {
            text: 'VRM 模型编辑器',
            link: 'https://vrm.advjs.org',
          },
        ],
      },
      {
        text: 'Help',
        items: [
          {
            text: 'GitHub Issues',
            link: 'https://github.com/YunYouJun/advjs/issues',
          },
          {
            text: 'GitHub Discussions',
            link: 'https://github.com/YunYouJun/advjs/discussions',
          },
        ],
      },
    ],
  },
]

function sidebarAGUI(): DefaultTheme.SidebarItem[] {
  const components = [
    {
      key: 'layout',
      name: 'Layout 布局',
    },
    {
      key: 'assets-explorer',
      name: 'Assets Explorer 资源管理器',
    },
    {
      key: 'button',
      name: 'Button 按钮',
    },
    {
      key: 'checkbox',
      name: 'Checkbox 复选框',
    },
    {
      key: 'input',
      name: 'Input 输入框',
    },
    {
      key: 'input-number',
      name: 'InputNumber 计数器',
    },
    {
      key: 'number-slider',
      name: 'NumberSlider 数字滑块',
    },
    {
      key: 'radio',
      name: 'Radio 单选框',
    },
    {
      key: 'select',
      name: 'Select 选择器',
    },
    {
      key: 'sidebar',
      name: 'Sidebar 侧边栏',
    },
    {
      key: 'switch',
      name: 'Switch 开关',
    },
    {
      key: 'tabs',
      name: 'Tabs 标签页',
    },
    {
      key: 'tree',
      name: 'Tree 树形控件',
    },
  ]

  return [
    {
      text: 'AGUI 指南',
      collapsed: false,
      items: [
        {
          text: '介绍',
          link: '/agui/',
        },
        {
          text: '快速开始',
          link: '/agui/quick-start',
        },
      ],
    },
    {
      text: 'AGUI Components',
      collapsed: false,
      items:
        components.map(component => ({
          text: component.name,
          link: `/agui/components/${component.key}`,
        })),
    },
  ]
}

function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '指南',
      collapsed: false,
      items: [
        {
          text: '介绍',
          link: '/guide/',
        },
        {
          text: '快速开始',
          link: '/guide/quick-start',
        },
        {
          text: '运行与编译',
          link: '/guide/mode',
        },
        {
          text: '功能',
          link: '/guide/features',
        },
        {
          text: '导出',
          link: '/guide/export',
        },
        {
          text: '录制视频',
          link: '/guide/record/video',
        },
      ],
    },
    {
      text: '配置',
      collapsed: false,
      items: [
        {
          text: '基础配置',
          link: '/guide/config/',
        },

        {
          text: '动画',
          link: '/guide/config/animation',
        },
      ],
    },
    {
      text: '编辑器',
      collapsed: false,
      items: [
        {
          text: '核心编辑器',
          link: '/guide/editor/',

          items: [
            {
              text: '基础操作',
              link: '/guide/editor/basic',
            },
            {
              text: '剧本编辑器',
              link: '/guide/editor/script',
            },
            {
              text: '节点编辑器',
              link: '/guide/editor/flow',
            },
          ],
        },
        {
          text: 'VRM 模型编辑器',
          link: '/guide/editor/vrm',
        },
      ],
    },
    {
      text: 'AdvScript',
      collapsed: false,
      items: [
        { text: '什么是 AdvScript?', link: '/guide/advscript/' },
        { text: '基础语法', link: '/guide/advscript/syntax' },
        { text: '扩展语法', link: '/guide/advscript/code' },
        { text: '常见问题', link: '/guide/advscript/faq' },

        {
          text: '与 TypeScript 使用',
          link: '/guide/typescript/how',
        },
      ],
    },
  ]
}

function sidebarAbout(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '关于',
      collapsed: false,
      items: [
        {
          text: '关于 ADV.JS',
          link: '/about/index',
        },
      ],
    },
    {
      text: '设计',
      collapsed: false,
      items: [
        {
          text: '设计理念',
          link: '/about/design/index',
        },
        {
          text: '存储系统',
          link: '/about/design/storage',
        },
        {
          text: '国际化',
          link: '/about/design/i18n',
        },
      ],
    },
    {
      text: '开发',
      collapsed: false,
      items: [
        {
          text: '这是什么？',
          link: '/about/dev/',
        },
        {
          text: '开发规范',
          link: '/about/dev/standard',
        },
        {
          text: '图标 Icons',
          link: '/about/dev/icons',
        },
        {
          text: '解析器 Parser',
          link: '/about/dev/parser',
        },
        {
          text: '状态管理 Stores',
          link: '/about/dev/stores',
        },
        {
          text: '依赖',
          link: '/about/dev/dependencies',
        },
        {
          text: 'FAQ',
          link: '/about/dev/faq',
        },
        {
          text: '参考',
          link: '/about/dev/ref',
        },
      ],
    },
    {
      text: '未来',
      collapsed: false,
      items: [
        {
          text: '设想',
          link: '/about/future/index',
        },
      ],
    },
  ]
}

const ContributingSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Contributing',
    items: [
      {
        text: '参与贡献',
        link: '/contributing/',
      },
      {
        text: '文档写作指南',
        link: '/contributing/writing-guide',
      },
    ],
  },
]

const sidebar: DefaultTheme.Config['sidebar'] = {
  '/api/': typedocSidebar,

  '/guide/': sidebarGuide(),
  '/about/': sidebarAbout(),
  '/agui/': sidebarAGUI(),
  '/contributing/': ContributingSidebar,
  '/resources/': [
    {
      text: 'Resources',
      collapsed: true,
      items: [
        { text: '相关资源', link: '/resources/' },
        { text: '案例展示', link: '/resources/showcases' },
        { text: '学习资源', link: '/resources/learning' },
      ],
    },
  ],
}

const userConfig = defineConfig({
  ...metaData,

  head,

  // todo
  // algolia: {
  //   appId: "",
  //   apiKey: "",
  //   indexName: "",
  // },
  // iconClass: 'i-ri-video-chat-line',

  lastUpdated: true,

  themeConfig: {
    logo: '/favicon.svg',

    editLink: {
      pattern: 'https://github.com/YunYouJun/advjs/edit/main/docs/:path',
      text: '✍️ 帮助改善此页面',
    },

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/YunYouJun/advjs',
      },
      {
        icon: 'twitter',
        link: 'https://twitter.com/YunYouJun',
      },
      {
        icon: 'discord',
        link: 'https://discord.gg/HNNPywcTxw',
      },
    ],

    footer: {
      copyright: 'Copyright © 2021-PRESENT YunYouJun',
    },

    nav,
    sidebar,
  },

  locales: {
    root: {
      label: '简体中文',
    },
    en: {
      label: 'English',
    },
  },

  srcExclude: ['README.md'],

  vue: {
    template: {
      compilerOptions: {
        isCustomElement(tag) {
          return customElements.has(tag)
        },
      },
    },
  },
})

export default withMermaid(userConfig)
