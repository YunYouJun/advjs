import { Buffer } from 'node:buffer'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface CredentialScanInput {
  content?: string | Uint8Array
  label: string
  path?: string
}

export interface CredentialLeakViolation {
  label: string
  path?: string
  rule: string
}

const credentialRules = [
  { name: 'cloudflare-api-credential', pattern: /\bCLOUDFLARE_(?:API_TOKEN|API_KEY)\s*[:=]\s*[^\s"'<>]{8,}/iu },
  { name: 'authorization-bearer', pattern: /\b(?:authorization\s*:\s*)?bearer\s+[\w.~+/=-]{8,}/iu },
  { name: 'github-token', pattern: /\bgh[opsu]_\w{20,}\b/iu },
  { name: 'npm-token', pattern: /\bnpm_\w{20,}\b/iu },
  { name: 'openai-api-key', pattern: /\bsk-[\w-]{20,}\b/iu },
] as const

function scanContent(input: CredentialScanInput, path: string | undefined, content: Uint8Array | string) {
  const buffer = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content)
  if (buffer.byteLength > 10 * 1024 * 1024 || buffer.includes(0))
    return []
  const text = buffer.toString('utf8')
  return credentialRules.flatMap(rule => rule.pattern.test(text)
    ? [{ label: input.label, ...(path ? { path } : {}), rule: rule.name }]
    : [])
}

async function collectFiles(path: string): Promise<string[]> {
  const metadata = await stat(path)
  if (metadata.isFile())
    return [path]
  if (!metadata.isDirectory())
    return []
  const files: string[] = []
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const child = join(path, entry.name)
    if (entry.isDirectory())
      files.push(...await collectFiles(child))
    else if (entry.isFile())
      files.push(child)
  }
  return files
}

export async function scanCredentialLeaks(inputs: CredentialScanInput[]): Promise<CredentialLeakViolation[]> {
  const violations: CredentialLeakViolation[] = []
  for (const input of inputs) {
    if (input.content !== undefined)
      violations.push(...scanContent(input, undefined, input.content))
    if (input.path) {
      for (const file of await collectFiles(input.path))
        violations.push(...scanContent(input, file, await readFile(file)))
    }
  }
  return violations
}
