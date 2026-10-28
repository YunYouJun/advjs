import { isAbsolute } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createCreativeSingleAgentEvaluator } from '@advjs/agent/evaluation'
import { createCreativeEvaluationFileSink } from '@advjs/agent/evaluation/node'

// Server-owned module creates the concrete Runtime SDK caller with audited model,
// price and token bounds. No credentials or provider choice come from project data.
export async function createAdapter({ output }) {
  const bindingPath = process.env.ADVJS_CREATIVE_EVALUATION_BINDING
  if (!bindingPath || !isAbsolute(bindingPath))
    throw new Error('ADVJS_CREATIVE_EVALUATION_BINDING must identify an absolute trusted server module')
  const binding = await import(pathToFileURL(bindingPath).href)
  if (typeof binding.createEvaluationModel !== 'function')
    throw new TypeError('Trusted binding must export createEvaluationModel()')
  const model = await binding.createEvaluationModel()
  const sink = typeof output === 'string'
    ? createCreativeEvaluationFileSink(output)
    : { async write() { throw new Error('Execution output directory is required') } }
  return createCreativeSingleAgentEvaluator({ model, sink })
}
