import type { Options } from 'tsup'

export default <Options>{
  entry: [
    'src/index.ts',
    'src/core.ts',
    'src/fs.ts',
  ],
  clean: true,
  splitting: true,
  format: ['cjs', 'esm'],
  dts: true,
}
