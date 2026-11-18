import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { editorBundledPlugins } from '../../../editor/core/bundled-plugins'
import { readEditorPluginPackage } from '../../../packages/editor-sdk/src/node'

const folders: string[] = []
afterEach(() => {
  for (const root of folders.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'advjs-package-')))
  folders.push(root)
  mkdirSync(join(root, 'dist'))
  writeFileSync(join(root, 'dist/plugin.mjs'), 'export default {}')
  writeFileSync(join(root, 'dist/style.css'), '.example {}')
  const manifest: any = { name: '@example/editor-plugin', version: '1.0.0', advjs: { editorPlugin: { id: 'example.story', apiVersion: 1, entry: './dist/plugin.mjs', styles: ['./dist/style.css'] } } }
  const save = () => writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  save()
  return { root, manifest, save }
}
describe('editor plugin packages', () => {
  it('loads manifest entries and styles once, without executing Node host code', () => {
    const { root, manifest, save } = fixture()
    writeFileSync(join(root, 'host.mjs'), 'throw new Error(\'Do not execute\')')
    manifest.advjs.editorPlugin.host = './host.mjs'
    save()
    const pkg = readEditorPluginPackage(root)
    expect(pkg.id).toBe('example.story')
    expect(pkg.host).toBe(join(root, 'host.mjs'))
    const loader = editorBundledPlugins(undefined, JSON.stringify([root])).load as (id: string) => string
    const code = loader('\0virtual:advjs-editor-bundled-plugins')
    expect(code).toContain(JSON.stringify(pkg.entry))
    expect(code).toContain(JSON.stringify(pkg.styles[0]))
    expect(code).not.toContain('host.mjs')
    expect(() => editorBundledPlugins(undefined, JSON.stringify([root, root]))).toThrow('Duplicate')
  })
  it('rejects unsupported versions, missing ids, escaping files and URLs', () => {
    const { root, manifest, save } = fixture()
    const metadata = manifest.advjs.editorPlugin
    for (const bad of [2, '1', null]) {
      metadata.apiVersion = bad
      save()
      expect(() => readEditorPluginPackage(root)).toThrow('manifest')
    }
    metadata.apiVersion = 1
    delete metadata.id
    save()
    expect(() => readEditorPluginPackage(root)).toThrow('manifest')
    metadata.id = 'example.story'
    for (const entry of ['https://example.com/plugin.mjs', '/tmp/plugin.mjs', '../plugin.mjs']) {
      metadata.entry = entry
      save()
      expect(() => readEditorPluginPackage(root)).toThrow()
    }
    const other = fixture().root
    symlinkSync(join(other, 'dist/plugin.mjs'), join(root, 'dist/escape.mjs'))
    metadata.entry = './dist/escape.mjs'
    save()
    expect(() => readEditorPluginPackage(root)).toThrow('escapes')
    expect(() => editorBundledPlugins(undefined, '["relative"]')).toThrow('trusted absolute')
  })
})
