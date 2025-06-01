import { defineConfig } from 'tsdown'
import pkg from './package.json'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/fs.ts',
  ],
  clean: true,
  dts: true,
  external: [
    // @types/mdast
    'mdast',
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.peerDependencies),
    'consola',
  ],
})
