import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'
import consola from 'consola'
import { svg } from '../client/styles/icons'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distFolder = path.resolve(__dirname, '../dist')

function bCssVarsRootStyle() {
  const cssVars = Object.keys(svg)
    .map(key =>
      `--b-icon-${key}: url("data:image/svg+xml;utf8,${encodeURIComponent(svg[key as keyof typeof svg])}")`,
    )
    .join(';\n')

  return `:root { ${cssVars} }`
}

const iconCSSPath = path.resolve(distFolder, 'icons.css')
consola.info('Writing icons.css to', iconCSSPath)
fs.writeFileSync(iconCSSPath, bCssVarsRootStyle(), 'utf-8')
