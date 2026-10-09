/** JSON story execution only; no Markdown parser, UI, storage or asset loaders. */
export { createAdvRuntime } from './create'
export type { AdvRuntime, AdvRuntimeOptions, RuntimeSubscriber, RuntimeTraceSubscriber } from './create'
export {
  evaluateRuntimeExpression,
  parseRuntimeExpression,
  runtimeConditionMatches,
  RuntimeExpressionError,
} from './expression'
export {
  applyRuntimeStageOperation,
  derivePresentationState,
} from './presentation'
export type {
  RuntimePresentationDerivation,
  RuntimePresentationDiagnostic,
} from './presentation'
export {
  createRuntimeRegistry,
  defineAdvPlugin,
  validateRuntimeProgramPlugins,
} from './registry'
export type {
  AdvActionContext,
  AdvActionHandler,
  AdvActivityContext,
  AdvActivityHandler,
  AdvNodeContext,
  AdvNodeHandler,
  AdvRuntimePlugin,
  RuntimePluginDiagnostic,
  RuntimeRegistry,
} from './registry'
export {
  createRuntimeSnapshot,
  RuntimeSnapshotError,
  runtimeStatesEqual,
  validateRuntimeSnapshot,
} from './snapshot'
export { createInitialRuntimeState, getRuntimeNode, runtimeAddressKey } from './state'
export { diffRuntimeVariables } from './trace'
export { projectRuntimeNode, visibleRuntimeChoices } from './transition'
export type { RuntimeCommand } from './transition'
