import type { AdvAst } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { formatAsText, formatNode } from '../../src/engine/formatter'

describe('formatNode', () => {
  it('should format dialog node', () => {
    const node: AdvAst.Dialog = {
      type: 'dialog',
      character: { type: 'character', name: '云游君', status: 'smile' },
      children: [{ type: 'text', value: '你好世界！' }],
    }

    const result = formatNode(node)
    expect(result).toEqual({
      type: 'dialog',
      text: '你好世界！',
      character: '云游君',
      status: 'smile',
    })
  })

  it('should format dialog node without status', () => {
    const node: AdvAst.Dialog = {
      type: 'dialog',
      character: { type: 'character', name: '小云' },
      children: [{ type: 'text', value: '早上好！' }],
    }

    const result = formatNode(node)
    expect(result).toEqual({
      type: 'dialog',
      text: '早上好！',
      character: '小云',
      status: undefined,
    })
  })

  it('should format narration node', () => {
    const node: AdvAst.Narration = {
      type: 'narration',
      children: ['阳光洒入教室。', '尘埃在光束中飘舞。'],
    }

    const result = formatNode(node)
    expect(result).toEqual({
      type: 'narration',
      text: '阳光洒入教室。\n尘埃在光束中飘舞。',
    })
  })

  it('should format choices node', () => {
    const node: AdvAst.Choices = {
      type: 'choices',
      choices: [
        { type: 'choice', text: '前往城镇' },
        { type: 'choice', text: '探索森林' },
      ],
    }

    const result = formatNode(node)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('choices')
    if (result!.type === 'choices') {
      expect(result!.options).toHaveLength(2)
      expect(result!.options[0]).toEqual({ index: 1, label: '前往城镇' })
      expect(result!.options[1]).toEqual({ index: 2, label: '探索森林' })
    }
  })

  it('should format scene node', () => {
    const node: AdvAst.SceneInfo = {
      type: 'scene',
      place: '学校',
      time: '白天',
      inOrOut: '内景',
    }

    const result = formatNode(node)
    expect(result).toEqual({
      type: 'scene',
      text: '[场景] 学校 - 白天 - 内景',
      place: '学校',
      time: '白天',
    })
  })

  it('should format text node', () => {
    const node: AdvAst.Text = {
      type: 'text',
      value: '一段普通文字',
    }

    const result = formatNode(node)
    expect(result).toEqual({
      type: 'text',
      text: '一段普通文字',
    })
  })

  it('should return null for code node', () => {
    const node: AdvAst.Code = {
      type: 'code',
      lang: 'advnode',
      value: [],
    }

    const result = formatNode(node)
    expect(result).toBeNull()
  })

  it('should return null for null/undefined node', () => {
    expect(formatNode(null as any)).toBeNull()
    expect(formatNode(undefined as any)).toBeNull()
  })
})

describe('formatAsText', () => {
  it('should format dialog with status', () => {
    const text = formatAsText({
      type: 'dialog',
      text: '你好！',
      character: '云游君',
      status: 'smile',
    })
    expect(text).toBe('云游君(smile): 你好！')
  })

  it('should format dialog without status', () => {
    const text = formatAsText({
      type: 'dialog',
      text: '你好！',
      character: '云游君',
    })
    expect(text).toBe('云游君: 你好！')
  })

  it('should format narration', () => {
    const text = formatAsText({
      type: 'narration',
      text: '夜幕降临。',
    })
    expect(text).toBe('  "夜幕降临。"')
  })

  it('should format end', () => {
    const text = formatAsText({
      type: 'end',
      text: '— END —',
    })
    expect(text).toBe('\n— END —\n')
  })
})
