import type { AdvAst, AdvTachieNode, Tachie } from '@advjs/types'
import type { AdvContext } from '../types'
import { getCharacter } from '@advjs/core'
import { consola } from 'consola'
import { computed } from 'vue'

export function useAdvTachies($adv: AdvContext) {
  const store = $adv.store
  const gameConfig = $adv.gameConfig

  /**
   * tachies map by cur characters
   */
  const tachies = computed(() => {
    const tachiesMap = new Map<string, Tachie>()

    if (store.cur.tachies.size) {
      store.cur.tachies.forEach((tachie, key) => {
        const character = getCharacter(gameConfig.value.characters, key)
        if (character && character.tachies)
          tachiesMap.set(key, character.tachies[tachie.status || 'default'])
      })
    }

    return tachiesMap
  })

  function enter(name: string, status = 'default') {
    const character = getCharacter(gameConfig.value.characters, name)
    if (!character) {
      consola.warn(`Can not find ${name}`)
      return
    }

    const tachie = character.tachies?.[status]
    if (!tachie) {
      consola.error(`Can not find ${name}'s tachie: ${status}`)
      return
    }

    tachies.value.set(character.id || character.name, { status })
  }

  function exit(name: string) {
    tachies.value.delete(name)
  }

  function handle(node: AdvAst.Tachie) {
    if (node.enter) {
      if (typeof node.enter === 'string') {
        enter(node.enter)
      }
      else {
        node.enter.forEach((item) => {
          let cName
          let cStatus
          if (typeof item === 'string') {
            cName = item
          }
          else {
            cName = item.name
            cStatus = item.status
          }
          enter(cName, cStatus || 'default')
        })
      }
    }
    if (node.exit) {
      if (typeof node.exit === 'string') {
        exit(node.exit)
      }
      else {
        node.exit.forEach((item) => {
          exit(item)
        })
      }
    }

    // AdvTachieNode
    const tachieNode = node as any as AdvTachieNode
    switch (tachieNode.action) {
      case 'enter':
        enter(tachieNode.name, tachieNode.status || 'default')
        break
      case 'exit':
        exit(tachieNode.name)
        break
      default:
        break
    }

    // toggle tachie & show next text
    return true
  }

  function update(curNode: AdvAst.Dialog) {
    const character = getCharacter(
      gameConfig.value.characters,
      curNode.character.name,
    )
    if (!character)
      return

    // tachie of this character is displayed
    if (!store.cur.tachies.has(character.name))
      return

    store.cur.tachies.set(character.name, { status: curNode.character.status || 'default' })
  }

  return {
    /**
     * enter tachie
     */
    enter,
    /**
     * exit tachie
     */
    exit,
    handle,
    update,

    map: tachies,
  }
}
