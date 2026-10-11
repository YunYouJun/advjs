import { readGlossaryContent } from '@advjs/parser'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdvGlossaryContent from '../../../packages/client/components/ui/AdvGlossaryContent'

const content = [
  { type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: '中文术语' }] }, { type: 'text', value: ' and ' }, { type: 'emphasis', children: [{ type: 'text', value: 'English' }] }, { type: 'inlineCode', value: '<script>alert(1)</script>' }] },
  { type: 'list', ordered: false, children: [{ type: 'listItem', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'First' }] }] }] },
  { type: 'list', ordered: true, start: 3, children: [{ type: 'listItem', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Third' }] }] }] },
]

describe('glossary Markdown elements', () => {
  it('renders fixed semantic elements with escaped text and no active HTML or links', () => {
    const wrapper = mount(AdvGlossaryContent, { props: { content, text: 'Fallback' } })
    expect(wrapper.get('strong').text()).toBe('中文术语')
    expect(wrapper.get('em').text()).toBe('English')
    expect(wrapper.get('code').text()).toBe('<script>alert(1)</script>')
    expect(wrapper.findAll('ul > li')).toHaveLength(1)
    expect(wrapper.get('ol').attributes('start')).toBe('3')
    expect(wrapper.find('script, a, img, iframe').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['html', 'image', 'link', 'script', 'iframe'])('uses the plain fallback for unsupported %s nodes', (type) => {
    const wrapper = mount(AdvGlossaryContent, { props: { content: [{ type, value: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' }], text: 'Safe <img> fallback' } })
    expect(wrapper.text()).toBe('Safe <img> fallback')
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })

  it('drops arbitrary element attributes and bounds hostile size, depth and cycles', () => {
    const safe = readGlossaryContent([{ type: 'paragraph', onclick: 'alert(1)', children: [{ type: 'text', value: 'safe', href: 'javascript:alert(1)' }] }])
    expect(safe).toEqual([{ type: 'paragraph', children: [{ type: 'text', value: 'safe' }] }])
    expect(readGlossaryContent([{ type: 'paragraph', children: [{ type: 'text', value: 'x'.repeat(100_001) }] }])).toBeUndefined()
    expect(readGlossaryContent(Array.from({ length: 1025 }).fill(content[0]))).toBeUndefined()
    const cycle: { type: string, children: unknown[] } = { type: 'strong', children: [] }
    cycle.children.push(cycle)
    expect(readGlossaryContent([{ type: 'paragraph', children: [cycle] }])).toBeUndefined()
    expect(readGlossaryContent([{ type: 'list', ordered: true, start: -1, children: [] }])).toBeUndefined()
  })

  it('preserves long Chinese/English fallback text without truncation', () => {
    const text = '长文本阅读 Long explanation '.repeat(200)
    const wrapper = mount(AdvGlossaryContent, { props: { text } })
    expect(wrapper.get('.adv-glossary-plain').text()).toBe(text.trim())
    wrapper.unmount()
  })
})
