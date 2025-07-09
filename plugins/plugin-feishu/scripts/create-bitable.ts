/**
 * 在知识库节点下创建 多维表格
 *
 * [ADV.JS/数据源](https://yunlefun.feishu.cn/wiki/FU4jwsDIOie6DekdWXrcRXZunle)
 */

import { client } from '../src'
import { SPACE_NODE, WIKI_ID } from './config'

async function main() {
  // try {
  //   const res = await client.bitable.app.create({
  //     data: {
  //       name: '一篇新的多维表格【ADV.JS】',
  //       folder_token: 'FU4jwsDIOie6DekdWXrcRXZunle',
  //     },
  //   })
  //   console.log('创建成功', res)
  // }
  // catch (error) {
  //   console.error('创建失败', error)
  // }

  // 在知识库节点下创建多维表格
  const res = await client.wiki.spaceNode.create({
    path: {
      space_id: WIKI_ID.ADVJS,
    },
    data: {
      obj_type: 'bitable',
      parent_node_token: SPACE_NODE.ADVJS.DATA_SOURCE, // 知识库节点的 token
      node_type: 'origin',
      title: '一篇新的多维表格【ADV.JS】',
    },
  })
  console.log('创建成功', res)
}

main()
