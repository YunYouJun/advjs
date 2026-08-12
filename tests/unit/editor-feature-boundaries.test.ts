import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveEditorCapabilities,
  shouldFetchEditorResource,
} from '../../editor/core/capabilities'

const root = resolve(import.meta.dirname, '../..')

describe('editor feature boundaries', () => {
  it('starts in a network-free local mode by default', () => {
    expect(resolveEditorCapabilities({})).toEqual({
      account: false,
      integrations: {
        analytics: false,
        cos: false,
        feishu: false,
        github: false,
      },
      localWorkspace: true,
      mode: 'local',
      onlineProjects: false,
    })
  })

  it('only enables online capabilities with explicit configuration', () => {
    expect(resolveEditorCapabilities({ ADVJS_EDITOR_MODE: 'online' })).toMatchObject({
      account: false,
      integrations: {
        analytics: false,
        cos: false,
        feishu: false,
        github: false,
      },
      mode: 'online',
      onlineProjects: true,
    })

    expect(resolveEditorCapabilities({
      ADVJS_EDITOR_CLARITY_ID: 'clarity-project',
      ADVJS_EDITOR_ENABLE_COS: '1',
      ADVJS_EDITOR_MODE: 'online',
      NUXT_FEISHU_APP_ID: 'feishu-id',
      NUXT_FEISHU_APP_SECRET: 'feishu-secret',
      NUXT_OAUTH_GITHUB_CLIENT_ID: 'github-id',
      NUXT_OAUTH_GITHUB_CLIENT_SECRET: 'github-secret',
    })).toEqual({
      account: true,
      integrations: {
        analytics: true,
        cos: true,
        feishu: true,
        github: true,
      },
      localWorkspace: true,
      mode: 'online',
      onlineProjects: true,
    })
  })

  it('blocks third-party resources in local mode while preserving local assets', () => {
    const local = resolveEditorCapabilities({})
    const online = resolveEditorCapabilities({ ADVJS_EDITOR_MODE: 'online' })

    expect(shouldFetchEditorResource('/bgm/library.json', local, 'http://127.0.0.1:3000')).toBe(true)
    expect(shouldFetchEditorResource('http://127.0.0.1:3000/bgm/library.json', local, 'http://127.0.0.1:3000')).toBe(true)
    expect(shouldFetchEditorResource('https://cdn.example.com/bgm.json', local, 'http://127.0.0.1:3000')).toBe(false)
    expect(shouldFetchEditorResource('https://cdn.example.com/bgm.json', online, 'http://127.0.0.1:3000')).toBe(true)
  })

  it('keeps optional SDKs and analytics outside the default startup chain', async () => {
    const [nuxtConfig, githubStore, feishuUtility, gameStore] = await Promise.all([
      readFile(resolve(root, 'editor/core/nuxt.config.ts'), 'utf8'),
      readFile(resolve(root, 'editor/core/app/stores/useGitHubStore.ts'), 'utf8'),
      readFile(resolve(root, 'editor/core/server/utils/feishu.ts'), 'utf8'),
      readFile(resolve(root, 'editor/core/app/stores/useGameStore.ts'), 'utf8'),
    ])

    expect(nuxtConfig).toContain('resolveEditorCapabilities')
    expect(nuxtConfig).toContain('disable: editorCapabilities.mode === \'local\'')
    expect(nuxtConfig).toContain('\'api/auth/github.get.ts\'')
    expect(nuxtConfig).toContain('\'api/feishu/**\'')
    expect(nuxtConfig).toContain('\'api/pageview.ts\'')
    expect(nuxtConfig).not.toContain('kq50mx5ttn')
    expect(githubStore).toContain('await import(\'@octokit/rest\')')
    expect(githubStore).not.toMatch(/import \{ Octokit \} from '@octokit\/rest'/)
    expect(feishuUtility).toContain('await import(\'@larksuiteoapi/node-sdk\')')
    expect(feishuUtility).not.toMatch(/import \* as lark from '@larksuiteoapi\/node-sdk'/)
    expect(gameStore).not.toContain('DEFAULT_BGM_LIBRARY_URL')
    expect(gameStore).toContain('shouldFetchEditorResource')
  })
})
