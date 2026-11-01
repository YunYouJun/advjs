import type { HeadConfig } from 'vitepress'
import * as pkg from '../../package.json'
import { skinHeadScript } from '../theme/components/home/data/skin-ids'
import { metaData } from './constants'

const head: HeadConfig[] = [
  ['meta', { name: 'author', content: pkg.author.name }],
  [
    'meta',
    {
      name: 'keywords',
      content: 'advjs, game, engine, vue, novel',
    },
  ],
  ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],

  ['meta', { name: 'HandheldFriendly', content: 'True' }],
  ['meta', { name: 'MobileOptimized', content: '320' }],
  ['meta', { name: 'theme-color', content: '#000' }],

  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:site', content: pkg.homepage }],
  ['meta', { name: 'twitter:title', value: metaData.title }],
  ['meta', { name: 'twitter:description', value: metaData.description }],
  ['meta', { name: 'twitter:image', content: '/favicon.svg' }],

  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:locale', content: 'en_US' }],
  ['meta', { property: 'og:site', content: pkg.homepage }],
  ['meta', { property: 'og:site_name', content: metaData.title }],
  ['meta', { property: 'og:title', content: metaData.title }],
  ['meta', { property: 'og:image', content: '/assets/logo.svg' }],
  ['meta', { property: 'og:description', content: metaData.description }],
  // No web font requests: VitePress bundles Inter, and CJK text uses fonts already on the device.

  // The home page skin, applied before first paint so the page doesn't flash the default one.
  ['script', {}, skinHeadScript],
]

export default head
