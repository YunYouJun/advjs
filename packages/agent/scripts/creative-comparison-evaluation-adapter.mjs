import { isAbsolute } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createCreativeComparisonEvaluator } from '@advjs/agent/evaluation'
import { createCreativeEvaluationFileSink } from '@advjs/agent/evaluation/node'

export async function createAdapter({ output }) {
  const path = process.env.ADVJS_CREATIVE_EVALUATION_BINDING
  if (!path || !isAbsolute(path))
    throw new Error('An absolute trusted evaluation binding is required')
  const binding = await import(pathToFileURL(path).href)
  const model = await binding.createEvaluationModel()
  const crew = await binding.createEvaluationCrew()
  const sink = typeof output === 'string'
    ? createCreativeEvaluationFileSink(output)
    : { async write() {
        throw new Error('Execution output directory is required')
      } }
  return createCreativeComparisonEvaluator({ model, crew, sink })
}
