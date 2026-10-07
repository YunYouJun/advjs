import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'
import { prepareDesktopIcons } from './icons.mjs'
import { buildProjectTemplates } from './templates.mjs'

const root = resolve(import.meta.dirname, '..')
const configPath = resolve(root, 'tsconfig.json')
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
  throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
} })
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames, parsed.options))
if (diagnostics.length)
  throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: path => path, getNewLine: () => '\n' }))
await prepareDesktopIcons()
await mkdir(resolve(root, 'dist'), { recursive: true })
await writeFile(resolve(root, 'dist/project-templates.json'), JSON.stringify(await buildProjectTemplates(resolve(root, '../..'))))
for (const file of await readdir(resolve(root, 'src'))) {
  if (file.endsWith('.ts')) {
    const source = await readFile(resolve(root, 'src', file), 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
    await writeFile(resolve(root, 'dist', file.replace(/\.ts$/, '.mjs')), output.outputText.replace(/from '(\.\/[^']+)\.js'/g, 'from \'$1.mjs\''))
  }
  else if (file.endsWith('.cjs')) {
    await writeFile(resolve(root, 'dist', file), await readFile(resolve(root, 'src', file)))
  }
}
