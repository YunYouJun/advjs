import type { CreativeArtifact, CreativeTeamPlan } from '../../src'

export function creativePlan(): CreativeTeamPlan {
  return {
    protocolVersion: 1,
    projectId: 'station',
    projectRevision: 'r1',
    goal: '雨夜车站，两位主要人物，两个结局',
    limits: { maxTasks: 8, maxToolCalls: 32, maxReworkRounds: 2, maxMicroPoints: 100000 },
    tasks: [
      { id: 'cast', partner: 'character-designer', capability: 'design-characters', dependsOn: [], sourcePaths: ['adv/world.md'], instruction: '设计两个人物', expectedOutput: '人物档案与关系' },
      { id: 'script', partner: 'writer', capability: 'generate-chapter-draft', dependsOn: ['cast'], sourcePaths: ['adv/world.md'], instruction: '写双结局', expectedOutput: '可编译 AdvScript' },
      { id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: ['script'], sourcePaths: [], instruction: '选角与表演', expectedOutput: '配音方案与缺失清单' },
      { id: 'test', partner: 'playtester', capability: 'playtest-project', dependsOn: ['script'], sourcePaths: ['adv/world.md'], instruction: '独立检查', expectedOutput: '实际路径与问题证据' },
    ],
  }
}

export function creativeArtifact(overrides: Partial<CreativeArtifact> = {}): CreativeArtifact {
  return {
    id: 'people',
    runId: 'run1',
    taskId: 'cast',
    partner: 'character-designer',
    projectId: 'station',
    kind: 'characters',
    source: { projectId: 'station', revision: 'r1', files: { 'adv/world.md': 'saved world' }, upstream: [] },
    fingerprint: 'people-v1',
    summary: '两个人物',
    changes: [{ path: 'adv/characters/lin.character.md', before: null, after: '---\nid: lin\nname: 林舟\n---\n谨慎。' }],
    reviewCapabilities: ['create-source'],
    status: 'selected',
    ...overrides,
  }
}
