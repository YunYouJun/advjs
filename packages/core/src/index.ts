import { parse } from '@advjs/parser'

export interface AdvOptions {
  /**
   * 文本
   */
  text: string
}

export function createAdv(options: AdvOptions) {
  const { text } = options
  const advAst = parse(text)

  /**
   * 演出开始
   */
  function play() {

  }

  return {
    /**
     * 语法树
     */
    ast: advAst,

    play,
  }
}
