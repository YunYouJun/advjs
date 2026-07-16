import type { RuntimeProgram } from '@advjs/types'

export const runtimeConformanceProgram: RuntimeProgram = {
  schemaVersion: 1,
  id: 'conformance',
  hash: 'conformance-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'stage' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'stage',
      order: ['stage', 'line', 'choice', 'end'],
      nodes: {
        stage: {
          id: 'stage',
          kind: 'effects',
          data: {
            operations: [
              { type: 'background', url: 'night.webp' },
              { type: 'bgm', name: 'calm-night' },
            ],
          },
          next: { chapterId: 'chapter-1', nodeId: 'line' },
        },
        line: {
          id: 'line',
          kind: 'dialog',
          data: { character: '我', text: '星星正在移动。' },
          next: { chapterId: 'chapter-1', nodeId: 'choice' },
        },
        choice: {
          id: 'choice',
          kind: 'choices',
          data: { options: [{ id: 'observe', label: '继续观察' }] },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}
