import { describe, expect, it } from 'vitest'
import { getTemplate, listTemplates, suggestTemplateFor } from '../utils/templates/loadTemplate'

describe('template registry', () => {
  it('loads the W1 templates (life-story + training-drill)', () => {
    const all = listTemplates()
    const ids = all.map(t => t.id)
    expect(ids).toContain('life-story')
    expect(ids).toContain('training-drill')
  })

  it('every template has the required fields populated', () => {
    for (const tpl of listTemplates()) {
      expect(tpl.id, `${tpl.id}: id`).toBeTruthy()
      expect(tpl.name, `${tpl.id}: name`).toBeTruthy()
      expect(tpl.description, `${tpl.id}: description`).toBeTruthy()
      expect(tpl.version, `${tpl.id}: version`).toBeGreaterThan(0)
      expect(Array.isArray(tpl.recommendedSources), `${tpl.id}: recommendedSources`).toBe(true)
      expect(tpl.recommendedSources.length, `${tpl.id}: recommendedSources non-empty`).toBeGreaterThan(0)
      expect(tpl.systemPrompt.length, `${tpl.id}: systemPrompt`).toBeGreaterThan(20)
      expect(Array.isArray(tpl.characterArchetypes), `${tpl.id}: archetypes`).toBe(true)
      expect(tpl.characterArchetypes.length, `${tpl.id}: archetypes non-empty`).toBeGreaterThan(0)
      expect(Array.isArray(tpl.chapterStructure), `${tpl.id}: chapterStructure`).toBe(true)
      expect(tpl.chapterStructure.length, `${tpl.id}: chapterStructure non-empty`).toBeGreaterThan(0)
      expect(typeof tpl.sceneStyle, `${tpl.id}: sceneStyle`).toBe('string')
      expect(typeof tpl.ttsEnabled, `${tpl.id}: ttsEnabled`).toBe('boolean')
      expect(typeof tpl.knowledgeExtraction, `${tpl.id}: knowledgeExtraction`).toBe('boolean')
    }
  })

  it('every character archetype has role/voiceHint/tone', () => {
    for (const tpl of listTemplates()) {
      for (const arch of tpl.characterArchetypes) {
        expect(arch.role, `${tpl.id}: role`).toBeTruthy()
        expect(arch.voiceHint, `${tpl.id}: voiceHint`).toBeTruthy()
        expect(arch.tone, `${tpl.id}: tone`).toBeTruthy()
      }
    }
  })

  it('every chapter phase has phase/choices/targetTokens with sane bounds', () => {
    for (const tpl of listTemplates()) {
      for (const phase of tpl.chapterStructure) {
        expect(phase.phase).toBeTruthy()
        expect(phase.choices).toBeGreaterThanOrEqual(0)
        expect(phase.targetTokens).toBeGreaterThan(0)
        expect(phase.targetTokens).toBeLessThan(5000)
      }
    }
  })

  it('getTemplate returns the template for a known id', () => {
    const tpl = getTemplate('life-story')
    expect(tpl?.id).toBe('life-story')
  })

  it('getTemplate returns undefined for unknown id', () => {
    expect(getTemplate('does-not-exist')).toBeUndefined()
  })

  it('suggestTemplateFor honors suggestedTemplateId if present', () => {
    const tpl = suggestTemplateFor({ type: 'text', suggestedTemplateId: 'training-drill' })
    expect(tpl?.id).toBe('training-drill')
  })

  it('suggestTemplateFor falls back to recommendedSources match', () => {
    const tpl = suggestTemplateFor({ type: 'chat-log' })
    expect(tpl?.recommendedSources).toContain('chat-log')
  })

  it('suggestTemplateFor eventually falls back to any template', () => {
    // Unknown suggestion + a source type that might not be recommended by W1 templates
    const tpl = suggestTemplateFor({ type: 'text', suggestedTemplateId: 'unknown' })
    expect(tpl).toBeDefined()
  })
})
