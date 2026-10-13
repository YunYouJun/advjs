import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { loadProject } from 'advjs'
import { Buffer } from 'node:buffer'
import { FlowEditError, parseFlowProposalRequest, planFlowProposal, readFlowProposalSnapshot } from '@advjs/core'
import { z } from 'zod'

interface FlowToolOptions {
  cwd: string
  projectLoader: typeof loadProject
}

async function flowToolResult(operation: () => Promise<object>) {
  try {
    const result = await operation()
    const text = JSON.stringify(result, null, 2)
    const response = {
      content: [{ type: 'text' as const, text }],
      structuredContent: result as Record<string, unknown>,
      ...('valid' in result && result.valid === false ? { isError: true } : {}),
    }
    // Count both wire copies: MCP sends JSON as text and structured content.
    if (Buffer.byteLength(JSON.stringify(response), 'utf8') > 256 * 1024)
      throw new FlowEditError('ADV_FLOW_OUTPUT_LIMIT', 'Flow output exceeds the 256 KiB MCP limit. Use adv flow read or adv flow plan with --json locally for the complete result.')
    return response
  }
  catch (error) {
    // Unexpected loader failures may contain private filesystem or config data.
    const diagnostic = error instanceof FlowEditError
      ? { code: error.code, message: error.message, references: error.references }
      : { code: 'ADV_FLOW_LOAD_FAILED', message: 'Could not load the current project. Check the local project configuration and retry.' }
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify({ error: diagnostic }) }],
      structuredContent: { error: diagnostic },
    }
  }
}

/** Read and plan against one included native chapter; neither tool writes files. */
export function registerFlowProposalTools(server: McpServer, options: FlowToolOptions) {
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

  server.registerTool('adv_flow_read', {
    description: 'Read one existing native Flow chapter with stable node/line IDs, exact chapter revision, projectRevision, and compiler diagnostics. Use both revisions in adv_flow_plan. No files are modified.',
    inputSchema: { path: z.string().describe('Canonical project-relative path of an included .chapter.json file') },
    annotations,
  }, async ({ path }) => flowToolResult(async () => {
    const loaded = await options.projectLoader({ root: options.cwd })
    return readFlowProposalSnapshot({
      files: loaded.files,
      path,
      options: { plugins: Object.fromEntries(loaded.runtimePlugins.map(plugin => [plugin.name, plugin.version])) },
    })
  }))

  server.registerTool('adv_flow_plan', {
    description: 'Plan a reviewable edit to one existing native Flow chapter without modifying files. request must contain schemaVersion:1, path, expectedRevision, projectRevision, and commands (maximum 100 commands / 256 KiB). Copy both revisions from adv_flow_read. Update/delete-dialogue commands use lineId, never an array index. Returns the serializable request, before/after source, structured changes, diagnostics, and valid. A successful plan is not approval to apply or save.',
    // The shared runtime parser owns validation, including unknown keys, so
    // malformed requests receive the same structured errors as the CLI/Editor.
    inputSchema: { request: z.unknown().describe('Versioned Flow proposal request copied from the chapter snapshot and edited with stable-ID commands') },
    annotations,
  }, async ({ request }) => flowToolResult(async () => {
    const parsed = parseFlowProposalRequest(request)
    const loaded = await options.projectLoader({ root: options.cwd })
    return planFlowProposal({
      files: loaded.files,
      request: parsed,
      options: { plugins: Object.fromEntries(loaded.runtimePlugins.map(plugin => [plugin.name, plugin.version])) },
    })
  }))
}
