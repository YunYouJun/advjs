const messages = {
  content_too_large: 'Workspace content exceeds the 256 KiB text limit. Read smaller sections through existing project resources.',
  summary_too_large: 'Workspace summary exceeds the 256 KiB limit. Use the existing project resources to inspect smaller sections.',
  too_many_images: 'Workspace item exceeds the 64-image preview limit.',
  item_not_found: 'Workspace item no longer exists. Refresh the project.',
} as const

const fallback = 'Workspace operation could not be completed. Refresh the project and retry. Check local server diagnostics if the problem persists.'
const safeMessages = new WeakMap<object, string>()

/** Only fixed, application-owned messages may cross the tool error boundary. */
export class WorkspaceContentError extends Error {
  constructor(code: keyof typeof messages) {
    const message = Object.hasOwn(messages, code) ? messages[code] : fallback
    super(message)
    safeMessages.set(this, message)
  }
}

export async function workspaceToolResult<T>(operation: () => Promise<T>) {
  try {
    return await operation()
  }
  catch (error) {
    // Never stringify unexpected loader/validator failures: messages can contain
    // credentials, raw source, arbitrarily large payloads, or hostile getters.
    const text = typeof error === 'object' && error !== null
      ? safeMessages.get(error) ?? fallback
      : fallback
    return { isError: true, content: [{ type: 'text' as const, text }] }
  }
}
