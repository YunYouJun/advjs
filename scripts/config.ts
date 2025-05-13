import path from 'node:path'

export const cleanDirs = [
  // 'node_modules',
  'dist',
]

// dir
export const docsDir = path.resolve(import.meta.dirname, '../docs')

export const packagesDir = path.resolve(import.meta.dirname, '../packages')
export const typesDir = path.resolve(packagesDir, 'types')
