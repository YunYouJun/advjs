/**
 * generate json schema for *.adv.json / adv.config.json
 */

import path from 'node:path'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import fs from 'fs-extra'
import * as TJS from 'typescript-json-schema'
import { docsDir, typesDir } from './config'

async function generateSchema() {
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

  const typesConfigPath = path.resolve(typesDir, 'src/config/index.ts')
  const program = TJS.getProgramFromFiles(
    [typesConfigPath],
    compilerOptions,
  )

  // We can either get the schema for one file and one type...
  // Partial AdvConfig
  const schema = TJS.generateSchema(program, 'UserConfig', settings)

  // write schema to file
  const targetSchemaFile = path.resolve(typesDir, 'schema/adv.config.schema.json')
  await fs.writeJSON(targetSchemaFile, schema, {
    spaces: 2,
  })
  consola.success(colors.yellow('adv.config.json'), 'Schema generated successfully:', colors.cyan(targetSchemaFile))

  // copy for online schema link
  const publicSchemaDir = path.resolve(docsDir, 'public/schema')
  await fs.ensureDir(publicSchemaDir)
  const advConfigSchemaFile = path.resolve(publicSchemaDir, 'adv.config.schema.json')
  await fs.copyFile(targetSchemaFile, advConfigSchemaFile)
  consola.success('Schema copied to:', colors.cyan(advConfigSchemaFile))
}

generateSchema()
  .catch((error) => {
    console.error('Error generating schema:', error)
  })
