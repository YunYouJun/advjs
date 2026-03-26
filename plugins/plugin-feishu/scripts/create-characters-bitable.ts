/**
 * 在知识库节点下创建角色管理多维表格
 *
 * 包含两张表：
 * - characters: 角色信息表
 * - relationships: 角色关系表
 *
 * 运行: npx tsx scripts/create-characters-bitable.ts
 */

import { client } from '../src'
import { SPACE_NODE, WIKI_ID } from './config'

async function main() {
  // 1. 在知识库节点下创建多维表格
  console.log('正在创建角色管理多维表格...')
  const createRes = await client.wiki.spaceNode.create({
    path: {
      space_id: WIKI_ID.ADVJS,
    },
    data: {
      obj_type: 'bitable',
      parent_node_token: SPACE_NODE.ADVJS.DATA_SOURCE,
      node_type: 'origin',
      title: '角色管理【ADV.JS】',
    },
  })
  console.log('多维表格创建成功:', createRes)

  const nodeToken = createRes.data?.node?.obj_token
  if (!nodeToken) {
    console.error('未获取到 obj_token，无法创建数据表')
    return
  }

  console.log(`多维表格 app_token: ${nodeToken}`)
  console.log('请将此 token 填入 config.ts 的 BITABLE.CHARACTERS.APP_TOKEN')

  // 2. 创建 characters 表
  console.log('\n正在创建 characters 数据表...')
  const charactersTable = await client.bitable.appTable.create({
    path: {
      app_token: nodeToken,
    },
    data: {
      table: {
        name: 'characters',
        default_view_name: '角色列表',
        fields: [
          { field_name: 'id', type: 1 },
          { field_name: 'name', type: 1 },
          { field_name: 'avatar', type: 1 },
          { field_name: 'personality', type: 1 },
          { field_name: 'appearance', type: 1 },
          { field_name: 'background', type: 1 },
          { field_name: 'concept', type: 1 },
          { field_name: 'speechStyle', type: 1 },
          { field_name: 'faction', type: 1 },
          { field_name: 'tags', type: 1 },
          { field_name: 'alias', type: 1 },
          { field_name: 'cv', type: 1 },
          { field_name: 'actor', type: 1 },
        ],
      },
    },
  })
  console.log('characters 表创建成功:', charactersTable.data?.table_id)

  // 3. 创建 relationships 表
  console.log('\n正在创建 relationships 数据表...')
  const relationshipsTable = await client.bitable.appTable.create({
    path: {
      app_token: nodeToken,
    },
    data: {
      table: {
        name: 'relationships',
        default_view_name: '关系列表',
        fields: [
          { field_name: 'sourceId', type: 1 },
          { field_name: 'targetId', type: 1 },
          { field_name: 'type', type: 1 },
          { field_name: 'description', type: 1 },
        ],
      },
    },
  })
  console.log('relationships 表创建成功:', relationshipsTable.data?.table_id)

  console.log('\n=== 创建完成 ===')
  console.log('请将以下信息填入 config.ts:')
  console.log(`  APP_TOKEN: '${nodeToken}'`)
  console.log(`  TABLE_ID: '${charactersTable.data?.table_id}'`)
  console.log(`  RELATIONSHIPS_TABLE_ID: '${relationshipsTable.data?.table_id}'`)
}

main().catch(console.error)
