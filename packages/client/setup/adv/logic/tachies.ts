import { getCharacter } from '@advjs/core'
import type { AdvAst } from '@advjs/types'
import consola from 'consola'
import { useAdvStore } from '../store'
import { config } from '~/env'

export function useTachies() {
  const store = useAdvStore()
  const tachies = store.cur.tachies

  function enter(name: string, status = 'default') {
    const character = getCharacter(config.characters, name)
    if (!character) {
      consola.warn(`Can not find ${name}`)
      return
    }

    const tachie = character.tachies?.[status]
    if (!tachie) {
      consola.error(`Can not find ${name}'s tachie: ${status}`)
      return
    }

    tachies.set(character.name, { status })
  }

  function exit(name: string) {
    tachies.delete(name)
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
  }
}
