/**
 * visual novel
 */
export interface PominisAIVSConfig {
  title: string
  startNode: string
  characters: Character[]
  chapters: Chapter[]
}

interface Character {
  id: string
  name: string
  appearance: string
  appearance_prompt: string
  background: string
  concept: string
}

interface Chapter {
  id: string
  title: string
  startNodeId: string
  description: string
  nodes: VSNode[]
  entryPoints: Record<string, string>
}

export interface VSNode {
  id: string
  plot_summary: string
  imagePrompt: string
  dialogues: Dialogue[]
  choices?: Choice[]
  next?: string | null
  /**
   * background music theme id
   * from library
   */
  bgmThemeId?: string
}

interface Dialogue {
  speaker: string
  text: string
}

interface Choice {
  text: string
  targetId: string
}
