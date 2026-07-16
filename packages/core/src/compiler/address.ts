export interface RuntimeTargetReference {
  chapterId: string
  nodeId?: string
}

export type RuntimeTargetParseResult
  = | { ok: true, target: RuntimeTargetReference }
    | { ok: false, message: string }

const runtimeIdentifierPattern = /^(?!_)\w[\w.-]*$/u

export function isRuntimeIdentifier(value: string): boolean {
  return runtimeIdentifierPattern.test(value)
}

/** Parse author syntax without resolving chapter entries or checking existence. */
export function parseRuntimeTarget(raw: string, currentChapterId: string): RuntimeTargetParseResult {
  const fragments = raw.split('#')
  if (fragments.length > 2) {
    return {
      ok: false,
      message: `Invalid runtime target "${raw}": only one # fragment is allowed`,
    }
  }

  let chapterId: string
  let nodeId: string | undefined
  if (fragments.length === 1) {
    chapterId = fragments[0]
  }
  else {
    chapterId = fragments[0] || currentChapterId
    nodeId = fragments[1]
    if (!nodeId) {
      return {
        ok: false,
        message: `Invalid runtime target "${raw}": node fragment cannot be empty`,
      }
    }
  }

  if (!isRuntimeIdentifier(chapterId) || (nodeId !== undefined && !isRuntimeIdentifier(nodeId))) {
    return {
      ok: false,
      message: `Invalid runtime target "${raw}": identifiers may only contain letters, numbers, dots, underscores, and hyphens`,
    }
  }

  return {
    ok: true,
    target: { chapterId, nodeId },
  }
}
