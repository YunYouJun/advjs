import { getCharacter } from '@advjs/core'
import type { AdvAst } from '@advjs/types'
import consola from 'consola'
import { useAdvStore } from '../store'
import { config } from '~/env'

export function useTachies() {
  const store = useAdvStore()

  function handle(node: AdvAst.Tachie) {
    const tachies = store.cur.tachies
    if (node.enter) {
      node.enter.forEach((item) => {
        const character = getCharacter(config.characters, item.name)
        if (!character) {
          consola.warn(`Can not find ${item.name}`)
          return
        }

        const status = item.status || 'default'
        const tachie = character.tachies?.[status]
        if (!tachie) {
          consola.error(`Can not find ${item.name}'s tachie: ${status}`)
          return
        }

        tachies.set(character.name, { status })
      })
    }
    if (node.exit) {
      node.exit.forEach((item) => {
        tachies.delete(item)
      })
    }

    // toggle tachie & show next text
    return true
  }

  function update(curNode: AdvAst.Dialog) {
    const character = getCharacter(
      config.characters,
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
    handle,
    update,
  }
}

