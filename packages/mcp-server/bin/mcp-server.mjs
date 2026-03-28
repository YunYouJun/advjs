#!/usr/bin/env node
import process from 'node:process'
import { startMcpServer } from '../dist/index.mjs'

startMcpServer().catch((err) => {
  console.error('Failed to start MCP server:', err)
  process.exit(1)
})
