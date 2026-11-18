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
  const evaluator = createCreativeComparisonEvaluator({ model, crew, sink })
  return {
    ...evaluator,
    async run(input, context) {
      const result = await evaluator.run(input, context)
      if (typeof binding.finalizeEvaluationResult !== 'function')
        return result
      const checked = await binding.finalizeEvaluationResult(result)
      // A provider check may invalidate a sample, never replace its costs or upgrade its outcome.
      const final = { ...result, ...(checked.outcome === 'system' ? { outcome: 'system', stop: 'provider-comparison-invalid' } : {}), providerObservation: checked.providerObservation }
      await sink.write(`${input.key}/provider-check.json`, { executionOutcome: result.outcome, result: final })
      return { ...final, evidence: [...result.evidence, `${input.key}/provider-check.json`] }
    },
  }
}
