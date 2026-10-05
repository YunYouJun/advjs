<script setup lang="ts">
import type { VNode } from 'vue'
import { mdParse } from '@advjs/parser'
import { h, shallowRef, watch } from 'vue'

const props = defineProps<{ content: string }>()
type MarkdownNode = Awaited<ReturnType<typeof mdParse>>['children'][number]
const nodes = shallowRef<MarkdownNode[]>([])

watch(() => props.content, async (content, _, onCleanup) => {
  let current = true
  onCleanup(() => {
    current = false
  })
  const document = await mdParse(content)
  if (current)
    nodes.value = document.children
}, { immediate: true })

// Render only known Markdown nodes through Vue; project HTML is always text.
// A recursive render function keeps arbitrary Markdown nesting in one boundary.
function renderNode(node: MarkdownNode, key: number): VNode | string {
  const children = 'children' in node ? node.children.map(renderNode) : []
  const attrs = { key }
  switch (node.type) {
    case 'heading': return h(`h${Math.min(node.depth + 2, 6)}`, attrs, children)
    case 'paragraph': return h('p', attrs, children)
    case 'strong': return h('strong', attrs, children)
    case 'emphasis': return h('em', attrs, children)
    case 'delete': return h('del', attrs, children)
    case 'blockquote': return h('blockquote', attrs, children)
    case 'list': return h(node.ordered ? 'ol' : 'ul', { ...attrs, start: node.ordered ? node.start : undefined }, children)
    case 'listItem': return h('li', attrs, children)
    case 'code': return h('pre', attrs, [h('code', node.value)])
    case 'inlineCode': return h('code', attrs, node.value)
    case 'break': return h('br', attrs)
    case 'thematicBreak': return h('hr', attrs)
    case 'table': return h('div', { ...attrs, class: 'context-table' }, [h('table', [h('tbody', children)])])
    case 'tableRow': return h('tr', attrs, children)
    case 'tableCell': return h('td', attrs, children)
    case 'link':
      // Local Markdown paths are document references, not editor routes.
      return /^https?:\/\//i.test(node.url)
        ? h('a', { ...attrs, href: node.url, target: '_blank', rel: 'noopener noreferrer' }, children)
        : h('span', { ...attrs, title: node.url }, children)
    case 'image': return node.alt ?? ''
    case 'yaml':
    case 'definition': return ''
    default: return 'value' in node ? String(node.value) : h('span', attrs, children)
  }
}

const DocumentContent = () => nodes.value.map(renderNode)
</script>

<template>
  <div class="context-document">
    <DocumentContent />
  </div>
</template>

<style scoped>
.context-document {
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.context-document :deep(> :first-child) {
  margin-top: 0;
}
.context-document :deep(> :last-child) {
  margin-bottom: 0;
}
:deep(p) {
  margin: 0 0 12px;
}
:deep(h3),
:deep(h4),
:deep(h5),
:deep(h6) {
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}
:deep(h3) {
  font-size: 14px;
}
:deep(ul),
:deep(ol) {
  margin: 8px 0 12px;
  padding-left: 20px;
}
:deep(ul) {
  list-style: disc;
}
:deep(ol) {
  list-style: decimal;
}
:deep(li + li) {
  margin-top: 4px;
}
:deep(li > p) {
  margin: 0;
}
:deep(blockquote) {
  margin: 12px 0;
  padding-left: 12px;
  border-left: 2px solid var(--agui-c-border);
}
:deep(pre) {
  overflow-x: auto;
  padding: 8px;
  background: var(--agui-c-bg-soft);
  border-radius: 2px;
}
:deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
:deep(a) {
  color: var(--agui-c-link);
  text-decoration: underline;
}
:deep(hr) {
  margin: 12px 0;
  border: 0;
  border-top: 1px solid var(--agui-c-divider);
}
:deep(.context-table) {
  overflow-x: auto;
}
:deep(table) {
  width: 100%;
  border-collapse: collapse;
}
:deep(td) {
  padding: 4px 8px;
  border: 1px solid var(--agui-c-divider);
}
</style>
