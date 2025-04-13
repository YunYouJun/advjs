import type { AdvGameConfig } from '@advjs/types'
import type { PominisAIVSConfig } from './types'

/**
 * adapt ai pominis format
 *
 * @example https://cos.advjs.yunle.fun/games/the-lord-of-the-rings/index.ai.adv.json
 */
export function convertPominisAItoAdvConfig(options: {
  cdnUrl?: string
  config: PominisAIVSConfig
} = {
  config: {} as any,
}) {
  const advConfig = JSON.parse(JSON.stringify(options.config)) as PominisAIVSConfig
  const cdnUrlPrefix = options.cdnUrl

  const characterMap = new Map<string, string>()
  advConfig.characters.forEach((character) => {
    // characterMap.set(character.id, character.name)
    characterMap.set(character.name, character.id)

    const modifiedCharacter = character as any
    modifiedCharacter.avatar = `${cdnUrlPrefix}/characters/${character.name}.jpg`
  })

  for (let i = 0; i < advConfig.chapters.length; i++) {
    const chapter = advConfig.chapters[i]!
    for (let j = 0; j < chapter.nodes.length; j++) {
      const node = chapter.nodes[j]!;
      (node as any).type = 'dialogues' as any
      (node as any).target = node?.next
      delete node.next

      const modifiedNode = node as any
      modifiedNode.sceneId = `${node.id}_scene`

      // 提取 choices
      if (node.choices && node.choices.length > 0) {
        // delete node.choices
        // 当前节点后面插入 nodes 列表
        j += 1
        const choicesId = `${node.id}_choices`;
        (node as any).target = choicesId
        chapter.nodes.splice(j, 0, {
          id: choicesId,
          type: 'choices',
          choices: node.choices.map(choice => ({
            text: choice.text,
            target: choice.targetId,
          })),
        } as any)
      }

      /**
       * 修改 speaker id
       */
      if (node.dialogues && node.dialogues.length > 0) {
        node.dialogues.forEach((dialog) => {
          // dialog.speaker = advConfig.characters.find((c) => c.id === dialog.speaker)?.name
          dialog.speaker = characterMap.get(dialog.speaker) || dialog.speaker
        })
      }

      delete node.choices
    }
  }

  const modifiedAdvConfig = advConfig as any
  modifiedAdvConfig.scenes = []
  advConfig.chapters.forEach((chapter) => {
    if (chapter.id === 'chapter_1') {
      chapter.nodes.forEach((node) => {
        const modifiedNode = node as any
        if (modifiedNode.type === 'dialogues') {
          modifiedAdvConfig.scenes.push(
            {
              id: `${node.id}_scene`,
              type: 'image',
              src: `${cdnUrlPrefix}/nodes/${node.id}.jpg`,
            },
          )
        }
      })
    }
  })

  return advConfig as any as AdvGameConfig
}
