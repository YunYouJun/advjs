export interface AdvAgentIntegrationStatus {
  client: 'codex'
  ready: boolean
  checks: Array<{
    id: 'skills' | 'mcp'
    status: 'pass' | 'repair'
    message: string
  }>
  installCommand: string
  doctorCommand: string
}
