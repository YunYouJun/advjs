import escapeHtml from 'escape-html'
import prism from 'prismjs'
import 'prismjs/components/prism-json'

// ref
// https://github.com/vuejs/vitepress/blob/main/src/node/markdown/plugins/highlight.ts
function wrap(code: string, lang: string): string {
  if (lang === 'text')
    code = escapeHtml(code)

  return `<pre v-pre><code>${code}</code></pre>`
}

export function highlight(str: string, lang = 'json') {
  lang = lang.toLowerCase()
  const rawLang = lang
  const code = prism.highlight(str, prism.languages.json, lang)
  return wrap(code, rawLang)
}
