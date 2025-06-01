import type { AdvAst, AdvBackgroundNode, AdvDialoguesNode, AdvFlowNode, AdvTachieNode } from '@advjs/types'
import type { AdvContext } from '../types'
import { isScript, parseAst } from '@advjs/parser'

import { consola } from 'consola'
import { SceneSystem } from '../pixi/system/scene'
import { useAdvCamera } from './useAdvCamera'

/**
 * Game Logic Helper
 */
export function useAdvLogic($adv: AdvContext) {
  const store = $adv.store

  const useNav = () => {
    /**
     * go to scene
     * @param target
     */
    function go(target: string) {
      const order = store.ast.scene[target]
      if (Number.isNaN(order))
        consola.error(`Can not find screen ${target}`)
      else store.cur.order = order

      next()
    }

    /**
     * 下一部分
     */
    async function next(): Promise<void> {
      if (!store.ast)
        return

      const nodeLen = store.ast.children.length
      const curOrder = store.cur.order
      if (curOrder >= nodeLen)
        return

      store.cur.order++

      const curNode = store.curNode
      // 跳过无效节点（虽然应该不会有）
      if (!curNode)
        return next()

      if (__DEV__)
        consola.info(curNode)

      const skippedTypes = ['scene']
      if (skippedTypes.includes(curNode.type || ''))
        return next()

      if (await handleAdvNode(curNode))
        next()
    }

    return {
      next,
      go,
    }
  }

  const nav = useNav()

  /**
   * 理解文本
   * @param text
   */
  async function read(text: string) {
    store.ast = await parseAst(text)
  }

  /**
   * handle adv node
   * @param node
   */
  async function handleAdvNode(node: AdvAst.Item | AdvFlowNode) {
    switch (node.type) {
      case 'code': {
        if (await handleCode(node as any))
          return true
        break
      }
      case 'dialog':
      // watch dialog in AdvDialogBox
      // watch dialog in TachieBox to update Tachie
        break
      case 'text':
        store.cur.dialog = {
          type: 'dialog',
          character: {
            type: 'character',
            name: '',
            status: '',
          },
          children: [node as any],
        }
        break
      case 'narration':
      case 'choices':
        break

      // flow node
      case 'dialogues': {
        // watch dialog in AdvDialogBox

        // sceneId 存在则自动切换场景
        const { sceneId = '', bgmThemeId = '' } = node as AdvDialoguesNode
        if (sceneId) {
          $adv.pixiGame?.SceneSystem.load(sceneId)
        }
        if (bgmThemeId) {
          $adv.$bgm.stop()
          $adv.$bgm.playBgm(bgmThemeId)
        }
        break
      }
      case 'background': {
        consola.info('background', node)
        $adv.pixiGame?.SceneSystem.load((node as AdvBackgroundNode).name)
        break
      }
      case 'tachie': {
        await $adv.$tachies.handle(node as AdvTachieNode)
        break
      }
      default:
        return true
    }
  }

  /**
   * handle code block
   * @param node
   */
  async function handleCode(node: AdvAst.Code) {
    const lang = node.lang?.toLowerCase() || ''
    if (isScript(node)) {
      try {
        // ctx.functions[node.value]()
      }
      catch (e) {
        console.error(e)
        nav.next()
      }
    }
    else if (lang === 'advnode') {
      // node.value is an array
      if (!node.value)
        return

      if (Array.isArray(node.value)) {
        for (const advNode of node.value) {
          if (await handleCodeOperation(advNode))
            return true
        }
      }
    }
  }

  const camera = useAdvCamera()

  /**
   * run predefined
   * @param node Adv Node
   */
  async function handleCodeOperation(node: AdvAst.CodeOperation): Promise<boolean | void> {
    switch (node.type) {
      case 'tachie': {
        return $adv.$tachies.handle(node)
      }
      case 'camera':
        camera.handle()
        break
      case 'go':
        nav.go(node.target)
        break
      case 'background':
        if (node.name) {
          const bg = SceneSystem.instance?.load(node.name)
          if (bg)
            store.cur.background = bg[node.name]
        }
        else if (node.url) {
          store.cur.background = node.url
        }
        else { consola.warn('[adv] Can not find background') }
        return true
      default:
        break
    }
  }

  return {
    read,

    loadAst(ast: AdvAst.Root) {
      store.ast = ast

      // handle ast first node
      if (store.cur.order === 0 && ast.children[0])
        handleAdvNode(ast.children[0])
    },

    handleCode,
    handleAdvNode,
    nav,
  }
}
