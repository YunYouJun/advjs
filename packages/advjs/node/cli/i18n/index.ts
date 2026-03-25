import process from 'node:process'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

type Messages = Record<string, Record<string, string>>

const locales: Record<string, Messages> = {
  'en': en,
  'zh-CN': zhCN,
}

/**
 * Detect locale from --lang flag, environment variables, or default to 'en'
 */
function detectLocale(): string {
  // 1. --lang flag from process.argv
  const langIdx = process.argv.indexOf('--lang')
  if (langIdx !== -1 && process.argv[langIdx + 1])
    return normalizeLocale(process.argv[langIdx + 1])

  // 2. Environment variables
  const envLang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || ''
  if (envLang)
    return normalizeLocale(envLang)

  return 'en'
}

function normalizeLocale(raw: string): string {
  // e.g. "zh_CN.UTF-8" -> "zh", "zh-CN" -> "zh"
  const base = raw.split('.')[0].replace('_', '-')
  if (base.startsWith('zh'))
    return 'zh-CN'
  return 'en'
}

let currentLocale = detectLocale()
let currentMessages: Messages = locales[currentLocale] || locales.en

const PLACEHOLDER_REGEX = /\{(\d+)\}/g

/**
 * Set locale manually (used when --lang is parsed by yargs)
 */
export function setLocale(locale: string) {
  currentLocale = normalizeLocale(locale)
  currentMessages = locales[currentLocale] || locales.en
}

export function getLocale(): string {
  return currentLocale
}

/**
 * Translate a key with optional placeholder replacement
 *
 * @example t('play.session_not_found', sessionId) // "Session not found: abc"
 */
export function t(key: string, ...args: (string | number)[]): string {
  const [group, name] = key.split('.')
  const msg = currentMessages[group]?.[name] ?? (locales.en[group]?.[name]) ?? key

  return args.length
    ? msg.replace(PLACEHOLDER_REGEX, (_, i) => String(args[Number(i)] ?? ''))
    : msg
}
