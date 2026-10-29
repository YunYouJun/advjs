import { ADV_LANGUAGE_ID } from './advLanguage'

const EXT_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  vue: 'html',
  html: 'html',
  css: 'css',
  scss: 'scss',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  svg: 'xml',
}

/** Monaco language for a file name; `.adv.md` scripts use the ADV grammar. */
export function detectEditorLanguage(filename: string, fallback = 'plaintext'): string {
  if (!filename)
    return fallback
  if (filename.toLowerCase().endsWith('.adv.md'))
    return ADV_LANGUAGE_ID
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_LANGUAGE_MAP[ext] || fallback
}
