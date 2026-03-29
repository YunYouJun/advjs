import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export interface AiProviderPreset {
  id: string
  name: string
  baseURL: string
  models: string[]
  needsKey?: boolean
  registrationUrl?: string
}

export interface AiConfig {
  providerId: string
  apiKey: string
  model: string
  customBaseURL: string
  customModel: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  // Image generation (reserved)
  imageProvider: 'none' | 'runware' | 'hunyuan' | 'siliconflow' | 'openai-dall-e'
  imageApiKey: string
  imageModel: string
}

export const AI_PROVIDERS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    registrationUrl: 'https://platform.deepseek.com/',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3', 'THUDM/glm-4-9b-chat'],
    registrationUrl: 'https://cloud.siliconflow.cn/',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
    registrationUrl: 'https://platform.openai.com/',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat-v3-0324:free'],
    registrationUrl: 'https://openrouter.ai/',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3', 'qwen2.5', 'deepseek-r1'],
    needsKey: false,
  },
  {
    id: 'custom',
    name: 'Custom',
    baseURL: '',
    models: [],
  },
]

const DEFAULT_SYSTEM_PROMPT = `You are a creative assistant for ADV.JS, a visual novel game engine. Help users create characters, write scenes, design story branches, and build worlds for their visual novels. Respond in the user's language. Use markdown formatting when showing code or ADV.JS script examples.

## ADV.JS Project Structure

\`\`\`
adv/
├── world.md               # World setting & rules
├── outline.md             # Story outline & chapter breakdown
├── glossary.md            # Terminology table
├── chapters/
│   ├── README.md          # Chapter status overview
│   └── chapter_01.adv.md  # Chapter script
├── characters/
│   ├── README.md          # Character relationship overview
│   └── aria.character.md  # Character card
└── scenes/
    ├── README.md          # Scene inventory
    └── school.md          # Scene definition
\`\`\`

## File Formats

### Character Card (.character.md)
\`\`\`markdown
---
id: aria
name: 艾莉亚
aliases: [Aria, 班长]
tags: [女主角, 女性]
---
## 性格
(Personality description)
## 背景
(Background story)
## 外貌
(Appearance details)
## 关键信息
(Secrets, relationships, catchphrases)
\`\`\`

### Chapter Script (.adv.md)
\`\`\`markdown
---
plotSummary: Brief chapter summary
---
【Place，Time，Interior/Exterior】

> Narration or inner monologue.

@CharacterName(emotion)
Dialog text here.

- Choice option 1
- Choice option 2
\`\`\`

### Scene (.md in scenes/)
YAML frontmatter with: id, name, description, imagePrompt, type, tags.

## Creation Workflow

When helping create content, follow this order:
1. **World** → Establish setting, era, rules in world.md
2. **Characters** → Create .character.md files with personality, background, appearance
3. **Outline** → Design chapter breakdown with key events and branch points
4. **Scenes** → Define locations with atmosphere descriptions
5. **Chapters** → Write .adv.md scripts with dialog, narration, and choices
6. **Glossary** → Document special terms if applicable

## Quality Checklist

- All @CharacterName references must match existing .character.md files
- Character dialog must be consistent with their personality description
- Each chapter should have at least one meaningful choice/branch point
- Scene headers 【】 should reference defined scenes
- Terminology should be consistent with glossary.md
- Keep first chapters shorter (~40-60 lines) for quick iteration

## Presentation Style

- For dialog: present as the character speaking with their emotional state
- For narration: atmospheric description with scene details
- For choices: present all options clearly, hint at consequences
- Between chapters: provide brief recap of key events and choices`

function createDefaultConfig(): AiConfig {
  return {
    providerId: 'deepseek',
    apiKey: '',
    model: 'deepseek-chat',
    customBaseURL: '',
    customModel: '',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    imageProvider: 'none',
    imageApiKey: '',
    imageModel: '',
  }
}

const STORAGE_KEY = 'advjs-studio-ai'

export const useAiSettingsStore = defineStore('aiSettings', () => {
  const config = ref<AiConfig>(createDefaultConfig())

  const currentProvider = computed(() => {
    return AI_PROVIDERS.find(p => p.id === config.value.providerId) || AI_PROVIDERS[0]
  })

  const isConfigured = computed(() => {
    const provider = currentProvider.value
    if (provider.needsKey === false)
      return true
    if (config.value.providerId === 'custom')
      return !!(config.value.customBaseURL && config.value.customModel)
    return !!config.value.apiKey
  })

  const effectiveBaseURL = computed(() => {
    if (config.value.providerId === 'custom')
      return config.value.customBaseURL
    return currentProvider.value.baseURL
  })

  const effectiveModel = computed(() => {
    if (config.value.providerId === 'custom')
      return config.value.customModel
    return config.value.model
  })

  const availableModels = computed(() => {
    if (config.value.providerId === 'custom')
      return []
    return currentProvider.value.models
  })

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const defaults = createDefaultConfig()
        config.value = {
          ...defaults,
          ...parsed,
        }
      }
    }
    catch {
      // ignore
    }
  }

  function setProvider(providerId: string) {
    config.value.providerId = providerId
    const provider = AI_PROVIDERS.find(p => p.id === providerId)
    if (provider && provider.models.length > 0)
      config.value.model = provider.models[0]
  }

  function resetToDefaults() {
    config.value = createDefaultConfig()
  }

  // Persist on change
  watch(config, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  // Initialize
  loadFromStorage()

  return {
    config,
    currentProvider,
    isConfigured,
    effectiveBaseURL,
    effectiveModel,
    availableModels,
    setProvider,
    resetToDefaults,
  }
})
