import type { AdvAst } from '@advjs/types'
import type { VNodeChild } from 'vue'
import { readGlossaryContent } from '@advjs/parser'
import { defineComponent, h } from 'vue'

function inline(node: AdvAst.GlossaryInline): VNodeChild {
  if ('value' in node)
    return node.type === 'inlineCode' ? h('code', node.value) : node.value
  return h(node.type === 'strong' ? 'strong' : 'em', node.children.map(inline))
}

function block(node: AdvAst.GlossaryBlock): VNodeChild {
  if (node.type === 'paragraph')
    return h('p', node.children.map(inline))
  return h(node.ordered ? 'ol' : 'ul', node.ordered ? { start: node.start } : {}, node.children.map(item => h('li', item.children.map(block))))
}

/** Fixed Vue element allowlist; no HTML parsing, URLs, arbitrary tags or props. */
export default defineComponent({
  name: 'AdvGlossaryContent',
  props: {
    content: { type: null, default: undefined },
    text: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const content = readGlossaryContent(props.content)
      return h('div', { class: 'adv-glossary-content' }, content
        ? content.map(block)
        : [h('p', { class: 'adv-glossary-plain' }, props.text)])
    }
  },
})
