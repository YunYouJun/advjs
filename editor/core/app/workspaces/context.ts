import type { EditorProjectModel } from '../adapters/browser/project'

/** Saved authoring material belonging to one compiled workspace snapshot. */
export interface EditorProjectContext {
  worldContent: string
  outlineContent: string
  glossaryContent: string
  chaptersReadme: string
  charsReadme: string
  scenesReadme: string
  sections: Array<{ title: string, content: string }>
  stats: { chapters: number, characters: number, scenes: number }
}

/** Derive author context from the same saved files used by the preview. */
export function collectProjectContext(model?: EditorProjectModel): EditorProjectContext {
  const project = model?.compilation.project
  const sourceMap = model?.compilation.sourceMap
  const root = project?.root && project.root !== '.' ? `${project.root}/` : ''
  const read = (path: string): string => model?.files[`${root}${path}`] ?? ''
  const context: EditorProjectContext = {
    worldContent: read('world.md'),
    outlineContent: read('outline.md'),
    glossaryContent: read('glossary.md'),
    chaptersReadme: read('chapters/README.md'),
    charsReadme: read('characters/README.md'),
    scenesReadme: read('scenes/README.md'),
    sections: [],
    stats: {
      chapters: project?.chapters.length ?? 0,
      characters: project?.characters.length ?? 0,
      scenes: project?.scenes.length ?? 0,
    },
  }
  const sourceContent = (paths: string[]): string => [...new Set(paths)]
    .map(path => model?.files[path] ? `## ${path}\n\n${model.files[path]}` : '')
    .filter(Boolean)
    .join('\n\n')

  context.sections = [
    { title: 'World', content: context.worldContent },
    { title: 'Outline', content: context.outlineContent },
    { title: 'Glossary', content: context.glossaryContent },
    { title: 'Chapters index', content: context.chaptersReadme },
    { title: 'Characters index', content: context.charsReadme },
    { title: 'Scenes index', content: context.scenesReadme },
    { title: 'Characters', content: sourceContent(Object.values(sourceMap?.characters ?? {})) },
    { title: 'Chapters', content: sourceContent(project?.chapters.flatMap(chapter => chapter.sources) ?? []) },
    { title: 'Scenes', content: sourceContent(Object.values(sourceMap?.scenes ?? {})) },
  ].filter(section => section.content.trim())
  return context
}
