// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { githubRuleset, pagesPreviewProject } from '../../../scripts/ci/deployment-policy.mjs'
import { assertDesktopChecks } from '../../../scripts/ci/desktop-required.mjs'
import { matchesWatchPath } from '../../../scripts/cloudflare-pages-watch.mjs'

function desktopNeeds(packageRequired = false) {
  return {
    'build': { result: 'success', outputs: { package: String(packageRequired) } },
    'linux-package': { result: packageRequired ? 'success' : 'skipped' },
    'full-matrix': { result: 'skipped' },
  }
}

describe('required desktop checks', () => {
  it('allows intentionally skipped packaging for unaffected pull requests', () => {
    expect(() => assertDesktopChecks({ needs: desktopNeeds(), event: 'pull_request' })).not.toThrow()
  })
  it.each(['failure', 'cancelled', 'skipped'])('rejects a required Linux package result: %s', (result) => {
    const needs = desktopNeeds(true)
    needs['linux-package'].result = result
    expect(() => assertDesktopChecks({ needs, event: 'pull_request' })).toThrow('linux-package=')
  })
  it('rejects a failed desktop build even when packaging is skipped', () => {
    const needs = desktopNeeds()
    needs.build.result = 'failure'
    expect(() => assertDesktopChecks({ needs, event: 'pull_request' })).toThrow('build=failure; expected success')
  })
  it('requires the full matrix for manual desktop validation', () => {
    const needs = desktopNeeds()
    expect(() => assertDesktopChecks({ needs, event: 'workflow_dispatch' })).toThrow('full-matrix=')
    needs['full-matrix'].result = 'success'
    expect(() => assertDesktopChecks({ needs, event: 'workflow_dispatch' })).not.toThrow()
  })
  it('rejects a missing packaging decision instead of treating it as unaffected', () => {
    const needs = desktopNeeds()
    needs.build.outputs.package = ''
    expect(() => assertDesktopChecks({ needs, event: 'pull_request' })).toThrow('true/false build.outputs.package')
  })
})

describe('deployment policy', () => {
  it('requires first-party CI for both active branches without provider preview checks', () => {
    const ruleset = githubRuleset()
    expect(ruleset.conditions.ref_name.include).toEqual(['refs/heads/dev', 'refs/heads/main'])
    expect(ruleset.rules[0].parameters.required_status_checks.map(check => check.context)).toEqual([
      'launch-required',
      'docs-build',
      'demo-build',
      'parser-browser-smoke',
      'desktop-required',
    ])
    expect(ruleset.rules[0].parameters.required_status_checks.every(check => check.integration_id === 15368)).toBe(true)
  })
  it.each(['docs', 'demo', 'parser'])('creates a %s preview without publishing production or inheriting runtime secrets', (key) => {
    const project = pagesPreviewProject(key, { full_name: 'YunYouJun/advjs', id: 300401568, owner: { id: 25154432 } })
    expect(project.source.config.production_deployments_enabled).toBe(false)
    expect(project.source.config.preview_branch_excludes).toEqual(['dev', 'main'])
    expect(Object.keys(project.deployment_configs.preview.env_vars)).toEqual(['NODE_VERSION', 'PNPM_VERSION'])
    expect(project.source.config.path_includes).toContain('config/ci-deployment-policy.json')
  })
  it('rejects an unrelated repository before configuring a preview', () => {
    expect(() => pagesPreviewProject('docs', { full_name: 'other/repo' })).toThrow('Preview repository mismatch')
  })
  it('rebuilds the parser when copied story samples or shared CSS inputs change', () => {
    const project = pagesPreviewProject('parser', { full_name: 'YunYouJun/advjs', id: 300401568, owner: { id: 25154432 } })
    for (const path of [
      'demo/starter/public/md/chapters/hello.adv.md',
      'demo/love/public/md/chapters/1/intro.adv.md',
      'examples/adv-format/dialog.adv.md',
      'editor/core/uno.config.ts',
      'patches/example.patch',
    ]) {
      expect(project.source.config.path_includes.some(pattern => matchesWatchPath(path, pattern)), path).toBe(true)
    }
  })
})
