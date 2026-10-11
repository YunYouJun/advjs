#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

export const watchConfig = JSON.parse(readFileSync(new URL('../config/cloudflare-pages-build-watch.json', import.meta.url), 'utf8'))

export function getWatchPolicy(key) {
  const project = watchConfig.projects[key]
  if (!project)
    throw new Error(`Unknown Pages project: ${key}`)
  return {
    ...project,
    path_includes: [...new Set([...watchConfig.sharedIncludes, ...project.includes])],
    path_excludes: [...new Set([...watchConfig.sharedExcludes, ...project.excludes])],
  }
}

export function matchesWatchPath(path, pattern) {
  // Pages supports *, including /; it does not use gitignore/minimatch syntax.
  const escaped = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('.*')}$`).test(path.replaceAll('\\', '/'))
}

export function shouldBuild(key, paths, { commitCount = 1 } = {}) {
  // These push sizes bypass Pages' path filtering, including intentional empty pushes.
  if (paths.length === 0 || paths.length >= 3000 || commitCount >= 20)
    return true
  const policy = getWatchPolicy(key)
  return paths.some(path => !policy.path_excludes.some(pattern => matchesWatchPath(path, pattern))
    && policy.path_includes.some(pattern => matchesWatchPath(path, pattern)))
}

function withoutPaths(config) {
  const { path_includes, path_excludes, ...rest } = config
  return rest
}

export async function syncWatchPolicies({ accountId, token, apply = false, request = fetch }) {
  if (!accountId || !token)
    throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for --check or --apply')

  async function api(project, method = 'GET', body) {
    const response = await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    })
    const result = await response.json()
    if (!response.ok || !result.success)
      throw new Error(`Pages ${method} ${project} failed (HTTP ${response.status})`)
    return result.result
  }

  const [owner, repo] = watchConfig.repository.split('/')
  const plans = await Promise.all(Object.keys(watchConfig.projects).map(async (key) => {
    const policy = getWatchPolicy(key)
    const before = await api(policy.project)
    if (before.source?.type !== 'github' || before.source.config.owner !== owner || before.source.config.repo_name !== repo)
      throw new Error(`Repository mismatch for ${policy.project}`)
    if (before.build_config.build_command !== policy.buildCommand || before.build_config.destination_dir !== policy.destinationDir)
      throw new Error(`Build settings changed for ${policy.project}; review its watch paths before applying`)
    return { key, policy, before }
  }))

  const results = []
  for (const { key, policy, before } of plans) {
    const expected = { path_includes: policy.path_includes, path_excludes: policy.path_excludes }
    if (apply) {
      await api(policy.project, 'PATCH', {
        source: { type: before.source.type, config: { ...before.source.config, ...expected } },
      })
    }
    const after = apply ? await api(policy.project) : before
    const actual = { path_includes: after.source.config.path_includes, path_excludes: after.source.config.path_excludes }
    if (!isDeepStrictEqual(actual, expected))
      throw new Error(`Watch paths differ for ${policy.project}; run --apply to synchronize`)
    if (!isDeepStrictEqual(withoutPaths(after.source.config), withoutPaths(before.source.config))
      || !isDeepStrictEqual(after.build_config, before.build_config)
      || !isDeepStrictEqual(after.deployment_configs, before.deployment_configs)
      || after.production_branch !== before.production_branch) {
      throw new Error(`Unexpected settings change for ${policy.project}`)
    }
    results.push({ key, project: policy.project, ...actual, verified: true })
  }
  return results
}

async function main(args) {
  const [mode, ...paths] = args
  if (mode === '--paths') {
    if (!paths.length)
      throw new Error('Supply changed repository paths after --paths')
    console.log(JSON.stringify(Object.fromEntries(Object.keys(watchConfig.projects).map(key => [key, shouldBuild(key, paths)])), null, 2))
  }
  else if (mode === '--check' || mode === '--apply') {
    console.log(JSON.stringify(await syncWatchPolicies({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
      apply: mode === '--apply',
    }), null, 2))
  }
  else if (mode === undefined) {
    console.log(JSON.stringify(Object.fromEntries(Object.keys(watchConfig.projects).map(key => [key, getWatchPolicy(key)])), null, 2))
  }
  else {
    throw new Error('Usage: node scripts/cloudflare-pages-watch.mjs [--paths <files...> | --check | --apply]')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
