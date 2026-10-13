import { readFileSync } from 'node:fs'
import { watchConfig } from '../cloudflare-pages-watch.mjs'

export const deploymentPolicy = JSON.parse(readFileSync(new URL('../../config/ci-deployment-policy.json', import.meta.url), 'utf8'))

/** Return the required-check ruleset without replacing unrelated repository rules. */
export function githubRuleset() {
  const { github } = deploymentPolicy
  return {
    name: github.rulesetName,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: github.branches.map(branch => `refs/heads/${branch}`), exclude: [] } },
    rules: [{ type: 'required_status_checks', parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: github.checks.map(context => ({ context, integration_id: github.appId })),
    } }],
  }
}

/**
 * Return a Git-integrated Pages project restricted to preview branches.
 * @param key - Preview surface from the deployment policy.
 * @param repository - GitHub repository metadata used to verify the Git source.
 * @returns Cloudflare Pages project creation payload.
 */
export function pagesPreviewProject(key, repository) {
  const project = deploymentPolicy.cloudflare.projects[key]
  if (!project)
    throw new Error(`Unknown preview project: ${key}`)
  const [owner, repo] = deploymentPolicy.repository.split('/')
  if (repository.full_name !== deploymentPolicy.repository)
    throw new Error('Preview repository mismatch')
  return {
    name: project.name,
    production_branch: 'dev',
    build_config: { build_command: project.buildCommand, destination_dir: project.outputDirectory, root_dir: '', build_caching: true },
    source: { type: 'github', config: {
      owner,
      owner_id: String(repository.owner.id),
      repo_name: repo,
      repo_id: String(repository.id),
      production_branch: 'dev',
      deployments_enabled: true,
      production_deployments_enabled: false,
      pr_comments_enabled: true,
      preview_deployment_setting: 'custom',
      preview_branch_includes: ['*'],
      preview_branch_excludes: ['dev', 'main'],
      path_includes: [...new Set([...watchConfig.sharedIncludes, ...deploymentPolicy.cloudflare.sharedPaths, ...project.paths])],
      path_excludes: [],
    } },
    deployment_configs: { preview: { env_vars: {
      NODE_VERSION: { type: 'plain_text', value: readFileSync(new URL('../../.node-version', import.meta.url), 'utf8').trim() },
      PNPM_VERSION: { type: 'plain_text', value: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).packageManager.split('@')[1] },
    } } },
  }
}
