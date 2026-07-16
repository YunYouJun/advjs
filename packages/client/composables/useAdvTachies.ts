import type { AdvAst, AdvTachieNode } from '@advjs/types'
import type { AdvContext } from '../types'
import { getCharacter } from '@advjs/core'
import { consola } from 'consola'

export function useAdvTachies($adv: AdvContext) {
  const { tachiesMapRef } = $adv.resources

  function enter(name: string, status = 'default') {
    const character = getCharacter($adv.gameConfig.value.characters, name)
    if (!character) {
      consola.warn(`Can not find ${name}`)
      return
    }
    tachiesMapRef.value = new Map(tachiesMapRef.value).set(character.id || character.name, { status })
  }

  function exit(name: string) {
    const next = new Map(tachiesMapRef.value)
    next.delete(name)
    tachiesMapRef.value = next
  }

  async function handle(node: AdvAst.Tachie | AdvTachieNode) {
    const flowNode = node as AdvTachieNode
    if (flowNode.action === 'enter')
      enter(flowNode.name, flowNode.status || 'default')
    else if (flowNode.action === 'exit')
      exit(flowNode.name)
    return true
  }

  return { enter, exit, handle }
}
