import type { CreativePartnerOutput, CreativeTeamHandoff, CreativeTeamRun } from '@advjs/agent'

/** Deterministic model substitute for starting at a real template; never creative-quality evidence. */
export function productionStartFixtureOutput(run: CreativeTeamRun, handoff: CreativeTeamHandoff): CreativePartnerOutput {
  const task = run.plan.tasks.find(task => task.id === handoff.taskId)!
  if (task.capability === 'plan-production') {
    const sourcePaths = task.sourcePaths
    const tasks = [
      { id: 'cast', partner: 'character-designer' as const, capability: 'design-characters' as const, dependsOn: [] },
      { id: 'script', partner: 'writer' as const, capability: 'write-chapters' as const, dependsOn: ['cast'] },
      { id: 'art', partner: 'art-director' as const, capability: 'direct-art' as const, dependsOn: ['cast'] },
      { id: 'voice', partner: 'voice-director' as const, capability: 'direct-voice' as const, dependsOn: ['script'] },
      { id: 'check', partner: 'playtester' as const, capability: 'playtest-project' as const, dependsOn: ['script', 'art', 'voice'] },
      { id: 'delivery', partner: 'director' as const, capability: 'summarize-production' as const, dependsOn: ['check'] },
    ]
    return { kind: 'production-plan', summary: '模板起步 · 六角色分工 fixture', plan: { protocolVersion: 1, projectId: run.plan.projectId, projectRevision: handoff.facts.revision, goal: run.plan.goal, limits: run.plan.limits, tasks: tasks.map(task => ({ ...task, sourcePaths, instruction: '确定性模型替身：验证本次输入与实际交接，不认证创作品质', expectedOutput: task.id === 'delivery' ? '作者明确请求后的实际证据摘要' : '等待作者审阅的结构化候选' })) } }
  }
  if (task.capability === 'design-characters') {
    return { kind: 'characters', summary: '模板起步 · 两位人物 fixture', characters: [
      { id: 'lin', name: '林舟', description: '雨夜车站的失物招领员', motivation: '归还未寄出的信', speakingStyle: '谨慎短句', visualConstraints: ['旧制服'], voiceConstraints: ['平静低声'], relationships: [{ targetId: 'qiao', type: '陌生人', description: '因为信封相识' }] },
      { id: 'qiao', name: '乔雨', description: '等待末班车的旅客', motivation: '寻找失联的姐姐', speakingStyle: '克制', visualConstraints: [], voiceConstraints: [], relationships: [] },
    ] }
  }
  if (task.capability === 'write-chapters') {
    const repair = run.tasks.find(state => state.taskId === task.id)?.playtestRepair
    const previous = run.artifacts.findLast(item => item.taskId === task.id && item.output?.kind === 'chapter')?.output
    if (repair && previous?.kind === 'chapter') {
      return { ...previous, summary: '模板起步 · 修复悬空结局 fixture', chapters: previous.chapters.map(chapter => ({ ...chapter, content: chapter.content.replace('missing#ending-leave', 'leave#ending-leave') })) }
    }
    const cast = handoff.candidates.find(item => item.output?.kind === 'characters')?.output
    if (cast?.kind !== 'characters')
      throw new Error('Template fixture requires the actual selected cast handoff')
    return { kind: 'chapter', summary: '模板起步 · 含预埋问题的章节 fixture', entryChapterId: '01', endingAddresses: ['stay#ending-stay', 'leave#ending-leave'], chapters: [
      { id: '01', title: '雨夜车站', content: `# 雨夜车站 {#arrival}\n\n@lin\n${cast.characters[0].motivation}。\n\n@qiao\n等我确认信上的名字。\n\n- [留下线索](stay#ending-stay)\n- [登上末班车](missing#ending-leave)\n` },
      { id: 'stay', title: '留下', content: '# 留下 {#ending-stay}\n\n> 乔雨留下姐姐的名字，和林舟继续寻找信的主人。\n' },
      { id: 'leave', title: '离开', content: '# 离开 {#ending-leave}\n\n> 车门合上。乔雨带走线索，林舟留在站台等回信。\n' },
    ] }
  }
  if (task.capability === 'direct-art')
    return { kind: 'art-direction', summary: '模板起步 · 美术交接 fixture', style: '冷灰雨夜，暖光信封；尚未制作真实图片', requests: [{ assetId: 'character/lin/default', kind: 'portrait', characterId: 'lin', width: 619, height: 619, prompt: '失物招领员，旧制服', constraints: ['只交接，未生成图片'] }] }
  if (task.capability === 'direct-voice')
    return { kind: 'voice-direction', summary: '模板起步 · 人物与旁白方案 fixture', cast: [{ speakerId: 'lin', designBrief: '谨慎低声', performance: '平静' }, { speakerId: 'qiao', designBrief: '克制', performance: '犹豫' }, { speakerId: 'narrator', designBrief: '独立旁白', performance: '客观' }], dictionary: [], lines: [] }
  if (task.capability === 'playtest-project')
    return { kind: 'playtest-plan', summary: '模板起步 · 两结局计划 fixture', scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }], concerns: [] }
  throw new Error('Template fixture does not implement this model capability')
}
