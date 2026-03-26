interface FormatterMessages {
  option_fallback: string
  choices_prompt: string
  scene_label: string
}

const en: FormatterMessages = {
  option_fallback: 'Option {0}',
  choices_prompt: 'Please choose:',
  scene_label: '[Scene]',
}

const zhCN: FormatterMessages = {
  option_fallback: '选项 {0}',
  choices_prompt: '请选择：',
  scene_label: '[场景]',
}

const locales: Record<string, FormatterMessages> = {
  'en': en,
  'zh-CN': zhCN,
}

function normalizeLocale(raw: string): string {
  const base = raw.split('.')[0].replace('_', '-')
  if (base.startsWith('zh'))
    return 'zh-CN'
  return 'en'
}

/**
 * Detect locale from browser or Node.js environment
 */
function detectLocale(): string {
  // Browser: use navigator.language
  if (typeof navigator !== 'undefined' && navigator.language)
    return normalizeLocale(navigator.language)

  // Node.js: use environment variables
  /* eslint-disable node/prefer-global/process */
  if (typeof process !== 'undefined' && process.env) {
    const envLang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || ''
    if (envLang)
      return normalizeLocale(envLang)
  }
  /* eslint-enable node/prefer-global/process */

  return 'en'
}

let currentMessages: FormatterMessages = locales[detectLocale()] || en

const PLACEHOLDER_REGEX = /\{(\d+)\}/g

export function setFormatterLocale(locale: string) {
  const normalized = normalizeLocale(locale)
  currentMessages = locales[normalized] || en
}

/**
 * Translate a formatter key with optional placeholder replacement
 */
export function tf(key: keyof FormatterMessages, ...args: (string | number)[]): string {
  const msg = currentMessages[key] ?? en[key] ?? key

  return args.length
    ? msg.replace(PLACEHOLDER_REGEX, (_, i) => String(args[Number(i)] ?? ''))
    : msg
}
