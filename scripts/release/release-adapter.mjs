import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function run(command, args, options = {}) {
  return (await execFileAsync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })).stdout.trim()
}

async function commandExists(command, args) {
  try {
    await run(command, args)
    return true
  }
  catch {
    return false
  }
}

export function createCommandReleaseAdapter(options = {}) {
  const repository = options.repository || process.env.GITHUB_REPOSITORY
  const accountId = options.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = options.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN
  const botActor = options.botActor || process.env.ADV_RELEASE_BOT_ACTOR
  if (!repository)
    throw new Error('GITHUB_REPOSITORY is required for release promotion')

  async function npmTags(name) {
    const output = await run('npm', ['view', name, 'dist-tags', '--json'])
    return output ? JSON.parse(output) : {}
  }

  async function pagesDeployments(manifest) {
    const wrangler = await import.meta.resolve('wrangler')
    const output = await run(process.execPath, [new URL(wrangler).pathname, 'pages', 'deployment', 'list', '--project-name', manifest.target.pagesProduction.project, '--environment', 'production', '--json'])
    return JSON.parse(output)
  }

  async function currentState(manifest) {
    const ref = JSON.parse(await run('gh', ['api', `repos/${repository}/git/ref/heads/main`]))
    const protection = JSON.parse(await run('gh', ['api', `repos/${repository}/branches/main/protection`]))
    const deployments = await pagesDeployments(manifest)
    const production = [...deployments].sort((left, right) => String(right.created_on).localeCompare(String(left.created_on)))[0]
    const npmDistTags = Object.fromEntries(await Promise.all(manifest.packages.map(async pkg => [pkg.name, await npmTags(pkg.name)])))
    return {
      branchProtection: {
        allowsDirectHumanPush: (protection.restrictions?.users?.length || 0) > 0 || (protection.restrictions?.teams?.length || 0) > 0,
        normalBotActor: protection.restrictions?.apps?.some(app => app.slug === botActor) ? botActor : undefined,
        requireLinearHistory: protection.required_linear_history?.enabled === true,
        rollbackBotActor: protection.restrictions?.apps?.some(app => app.slug === botActor) ? botActor : undefined,
      },
      mainSha: ref.object.sha,
      npmDistTags,
      pagesDeploymentId: production?.id,
      releaseExists: await commandExists('gh', ['release', 'view', manifest.target.tag, '--repo', repository]),
      tagExists: await commandExists('gh', ['api', `repos/${repository}/git/ref/tags/${manifest.target.tag}`]),
    }
  }

  return {
    currentState,
    async fastForwardMain(expected, target) {
      const state = await currentState(options.manifest)
      if (state.mainSha !== expected)
        throw new Error('main CAS failed before fast-forward')
      await run('gh', ['api', '--method', 'PATCH', `repos/${repository}/git/refs/heads/main`, '-f', `sha=${target}`, '-F', 'force=false'])
    },
    async waitForPages(sourceSha, manifest) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const deployments = await pagesDeployments(manifest)
        const match = deployments.find(deployment => deployment.deployment_trigger?.metadata?.commit_hash === sourceSha && deployment.latest_stage?.status === 'success')
        if (match)
          return { deploymentId: match.id, sourceSha, url: match.url }
        await new Promise(resolveDelay => setTimeout(resolveDelay, 5000))
      }
      throw new Error(`Cloudflare Pages did not produce a successful production deployment for ${sourceSha}`)
    },
    async promoteNpm(target) {
      for (const [name, tags] of Object.entries(target)) {
        const current = await npmTags(name)
        for (const [tag, version] of Object.entries(tags)) {
          if (current[tag] !== version)
            await run('npm', ['dist-tag', 'add', `${name}@${version}`, tag])
        }
      }
    },
    async createTag(tag, sha) {
      if (!await commandExists('gh', ['api', `repos/${repository}/git/ref/tags/${tag}`]))
        await run('gh', ['api', '--method', 'POST', `repos/${repository}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`])
    },
    async createRelease(tag, manifest) {
      if (!await commandExists('gh', ['release', 'view', tag, '--repo', repository]))
        await run('gh', ['release', 'create', tag, '--repo', repository, '--title', tag, '--notes-file', resolve(dirname(options.manifestPath), manifest.artifacts.changelog.path)])
    },
    async restoreNpm(previous, manifest) {
      for (const pkg of manifest.packages) {
        const current = await npmTags(pkg.name)
        const desired = previous[pkg.name] || {}
        for (const [tag, version] of Object.entries(desired)) {
          if (current[tag] !== version)
            await run('npm', ['dist-tag', 'add', `${pkg.name}@${version}`, tag])
        }
        for (const tag of Object.keys(current)) {
          if (!(tag in desired))
            await run('npm', ['dist-tag', 'rm', pkg.name, tag])
        }
      }
    },
    async rollbackPages(deploymentId, manifest) {
      if (!accountId || !apiToken)
        throw new Error('Cloudflare account ID and API token are required for a Pages rollback')
      const response = await (options.fetch || globalThis.fetch)(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${manifest.previous.pagesProduction.project}/deployments/${deploymentId}/rollback`, {
        headers: { 'authorization': `Bearer ${apiToken}`, 'content-type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok)
        throw new Error(`Cloudflare Pages rollback returned HTTP ${response.status}`)
    },
    async restoreMain(expected, previous, manifest) {
      const state = await currentState(manifest)
      if (state.mainSha !== expected)
        throw new Error('main restore CAS failed before non-fast-forward update')
      await run('gh', ['api', '--method', 'PATCH', `repos/${repository}/git/refs/heads/main`, '-f', `sha=${previous}`, '-F', 'force=true'])
    },
  }
}
