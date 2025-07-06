/**
 * generate json schema for *.adv.json / adv.config.json
 */

import path from 'node:path'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import fs from 'fs-extra'
import * as TJS from 'typescript-json-schema'

const typesDir = path.resolve(import.meta.dirname, '../src/types')
const schemaDir = path.resolve(typesDir, '../schema')

async function generateSchema(params: {
  files: string[]
  typeName: string
  /**
   * 输出文件夹
   */
  outputDir: string
  /**
   * .config.schema.json
   */
  targetFile: string
}) {
  // optionally pass argument to schema generator
  const settings: TJS.PartialArgs = {
    required: true,
  }

  // optionally pass ts compiler options
  const compilerOptions: TJS.CompilerOptions = {
    skipDefaultLibCheck: true,
    skipLibCheck: true,
    strictNullChecks: true,
  }

  const program = TJS.getProgramFromFiles(
    params.files,
    compilerOptions,
  )

  // We can either get the schema for one file and one type...
  // Partial AdvConfig
  const schema = TJS.generateSchema(program, params.typeName, settings)

  // write schema to file
  const targetSchemaFile = path.resolve(params.outputDir, params.targetFile)
  await fs.writeJSON(targetSchemaFile, schema, {
    spaces: 2,
  })
  consola.success(colors.yellow(params.targetFile), 'Schema generated successfully:', colors.cyan(targetSchemaFile))

  // copy for online schema link
  // const publicSchemaDir = path.resolve(docsDir, 'public/schema')
  // await fs.ensureDir(publicSchemaDir)
  // const advConfigSchemaFile = path.resolve(publicSchemaDir, params.targetFile)
  // await fs.copyFile(targetSchemaFile, advConfigSchemaFile)
  // consola.success('Schema copied to:', colors.cyan(advConfigSchemaFile))
}

generateSchema({
  files: [path.resolve(typesDir, 'index.ts')],
  typeName: 'AdvAIConfig',
  outputDir: schemaDir,
  targetFile: 'adv.ai.schema.json',
})
  .catch((error) => {
    console.error('Error generating schema:', error)
  })
