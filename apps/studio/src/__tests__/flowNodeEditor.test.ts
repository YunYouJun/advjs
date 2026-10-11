import type { FlowEditCommand, FlowEditDocument, FlowEditNode } from '@advjs/core'
import { applyFlowEdit, parseFlowDocument } from '@advjs/core'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import FlowNodeEditor from '../components/flow/FlowNodeEditor.vue'
import zh from '../i18n/locales/zh-CN.json'

function editor(node: FlowEditNode) {
  const wrapper = mount(FlowNodeEditor, { props: { node, index: 0, busy: false, assets: [] }, global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })] } })
  const field = (label: string) => wrapper.findAll('label').find(item => item.text() === label)!
  const command = () => wrapper.emitted('command')!.at(-1)![0] as FlowEditCommand
  const document: FlowEditDocument = parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [node] }))
  return { wrapper, field, command, edited: () => applyFlowEdit(document, command()).nodes[0]! }
}

describe('studio standard Flow node fields', () => {
  it('edits implicit dialogue nodes and displays legacy speakers without changing stable IDs or opaque data', async () => {
    const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
    const { wrapper, field, edited } = editor({ id: 'speech', dialogues: [{ lineId, speaker: 'hero', text: 'Before', originalNote: 'Keep' }], private: { keep: true } })
    expect(wrapper.find('h3').text()).toBe(zh.flowEditor.kinds.dialogues)
    expect(field(zh.flowEditor.speaker).find('input').element.value).toBe('hero')
    await field(zh.flowEditor.text).find('textarea').setValue('Changed')
    expect(edited()).toMatchObject({ id: 'speech', private: { keep: true }, dialogues: [{ lineId, speaker: 'hero', text: 'Changed', originalNote: 'Keep' }] })
    expect(edited().type).toBeUndefined()
    await field(zh.flowEditor.speaker).find('input').setValue('other')
    expect(edited().dialogues).toEqual([{ lineId, speakerId: 'other', text: 'Before', originalNote: 'Keep' }])
    await field(zh.flowEditor.speaker).find('input').setValue('')
    expect(edited().dialogues).toEqual([{ lineId, text: 'Before', originalNote: 'Keep' }])
    wrapper.unmount()
  })

  it('writes existing scene/source and tachie aliases fields while preserving their canonical shapes', async () => {
    const dialogue = editor({ id: 'speech', type: 'dialogues', dialogues: [{ text: 'Before' }], notes: { keep: true } })
    await dialogue.field(zh.flowEditor.scene).find('input').setValue('room')
    expect(dialogue.edited()).toMatchObject({ sceneId: 'room', notes: { keep: true } })
    dialogue.wrapper.unmount()
    const background = editor({ id: 'background', type: 'background', name: 'room', src: 'before.svg', original: true })
    await background.field(zh.flowEditor.backgroundSource).find('input').setValue('after.svg')
    expect(background.edited()).toMatchObject({ src: 'after.svg', original: true })
    background.wrapper.unmount()
    const tachie = editor({ id: 'actor', type: 'tachie', name: 'hero', action: 'exit', enter: 'hero', exit: ['hero'], notes: { keep: true } })
    await tachie.field(zh.flowEditor.exitAliases).find('textarea').setValue('"hero"')
    expect(tachie.edited()).toMatchObject({ exit: 'hero', notes: { keep: true } })
    await tachie.field(zh.flowEditor.enterAliases).find('textarea').setValue('["hero", "friend"]')
    expect(tachie.edited().enter).toEqual(['hero', 'friend'])
    const count = tachie.wrapper.emitted('command')!.length
    await tachie.field(zh.flowEditor.enterAliases).find('textarea').setValue('{"name":"not-supported"}')
    expect(tachie.wrapper.emitted('command')!.length).toBe(count)
    expect(tachie.field(zh.flowEditor.enterAliases).find('textarea').element.validity.valid).toBe(false)
    await tachie.field(zh.flowEditor.enterAliases).find('textarea').setValue('')
    expect(tachie.edited().enter).toBeUndefined()
    tachie.wrapper.unmount()
  })
})
