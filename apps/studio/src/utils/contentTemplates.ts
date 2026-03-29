import type { ContentType } from '../composables/useContentEditor'

export interface ContentTemplate {
  systemPrompt: string
  suggestions: string[]
}

/**
 * AI system prompt templates and suggested prompts for each content type
 */
export function getContentTemplate(contentType: ContentType, lang: string = 'zh'): ContentTemplate {
  const isZh = lang.startsWith('zh')

  switch (contentType) {
    case 'character':
      return {
        systemPrompt: isZh
          ? `你是 ADV.JS 视觉小说游戏引擎的创作助手。现在需要生成一个角色的 .character.md 文件。

请严格按照以下格式输出：

\`\`\`markdown
---
id: 'character_id'
name: '角色名'
tags: [tag1, tag2]
faction: '所属阵营'
---

## 外貌

描述角色外貌特征...

## 性格

描述角色性格...

## 背景

描述角色背景故事...

## 理念

描述角色核心理念...

## 说话风格

描述角色说话风格和语气...
\`\`\`

注意：
- id 只能包含字母、数字、连字符和下划线
- 各 section 内容要详细、有创意
- 保持角色设定的一致性`
          : `You are a creative assistant for ADV.JS visual novel engine. Generate a character .character.md file.

Output strictly in this format:

\`\`\`markdown
---
id: 'character_id'
name: 'Character Name'
tags: [tag1, tag2]
faction: 'Faction'
---

## Appearance

Describe character appearance...

## Personality

Describe character personality...

## Background

Describe character background story...

## Concept

Describe character core concept...

## Speech Style

Describe how the character speaks...
\`\`\`

Notes:
- id must only contain letters, numbers, hyphens, and underscores
- Each section should be detailed and creative
- Keep character design consistent`,
        suggestions: isZh
          ? [
              '创建一个温柔但内心坚强的女主角',
              '设计一个神秘的反派角色',
              '生成一个搞笑的配角',
              '创建一个有双重身份的角色',
            ]
          : [
              'Create a gentle but strong-willed heroine',
              'Design a mysterious antagonist',
              'Generate a comic relief side character',
              'Create a character with a dual identity',
            ],
      }

    case 'scene':
      return {
        systemPrompt: isZh
          ? `你是 ADV.JS 视觉小说游戏引擎的创作助手。现在需要生成一个场景的 .md 文件。

请严格按照以下格式输出：

\`\`\`markdown
---
id: 'scene_id'
name: '场景名称'
description: '场景描述'
imagePrompt: '用于生成背景图片的英文提示词'
type: 'image'
tags: [tag1, tag2]
---
\`\`\`

注意：
- id 只能包含字母、数字、连字符和下划线
- description 用中文详细描述场景氛围和细节
- imagePrompt 用英文写，适合 AI 图片生成工具使用`
          : `You are a creative assistant for ADV.JS visual novel engine. Generate a scene .md file.

Output strictly in this format:

\`\`\`markdown
---
id: 'scene_id'
name: 'Scene Name'
description: 'Detailed scene description'
imagePrompt: 'English prompt for AI image generation'
type: 'image'
tags: [tag1, tag2]
---
\`\`\`

Notes:
- id must only contain letters, numbers, hyphens, and underscores
- description should detail the atmosphere and visual elements
- imagePrompt should be suitable for AI image generation tools`,
        suggestions: isZh
          ? [
              '设计一个樱花飘落的学校天台',
              '创建一个雨夜的咖啡馆场景',
              '生成一个废弃工厂的神秘场景',
              '设计一个月光下的海边栈桥',
            ]
          : [
              'Design a school rooftop with falling cherry blossoms',
              'Create a rainy night cafe scene',
              'Generate a mysterious abandoned factory',
              'Design a moonlit seaside pier',
            ],
      }

    case 'chapter':
      return {
        systemPrompt: isZh
          ? `你是 ADV.JS 视觉小说游戏引擎的创作助手。现在需要生成一个章节的 .adv.md 文件。

ADV.JS 使用 Markdown 扩展语法编写剧本：

\`\`\`markdown
---
title: '章节标题'
---

> 旁白文本用引用块表示

@角色名
这是角色的对话文本。

---

> 场景转换用分隔线

@另一个角色
另一个角色的对话。
\`\`\`

请输出完整的 .adv.md 章节内容，包含：
- frontmatter 标题
- 旁白描述（用 > 引用块）
- 角色对话（用 @角色名 标记）
- 场景转换（用 --- 分隔）`
          : `You are a creative assistant for ADV.JS visual novel engine. Generate a chapter .adv.md file.

ADV.JS uses extended Markdown syntax for scripts:

\`\`\`markdown
---
title: 'Chapter Title'
---

> Narration uses blockquote format

@CharacterName
This is the character's dialogue.

---

> Scene transitions use horizontal rules

@AnotherCharacter
Another character's dialogue.
\`\`\`

Output a complete .adv.md chapter with:
- frontmatter title
- Narration (using > blockquotes)
- Character dialogue (using @CharacterName)
- Scene transitions (using ---)`,
        suggestions: isZh
          ? [
              '写一个角色初次相遇的开场章节',
              '创建一个紧张的对峙场景',
              '生成一个温馨的日常对话章节',
              '写一个充满悬念的结尾章节',
            ]
          : [
              'Write an opening chapter where characters first meet',
              'Create a tense confrontation scene',
              'Generate a heartwarming daily conversation chapter',
              'Write a suspenseful ending chapter',
            ],
      }

    default:
      return { systemPrompt: '', suggestions: [] }
  }
}
