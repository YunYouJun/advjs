import type { Options } from 'tsup'

export default <Options>{
  entry: ['src/index.ts'],
  clean: true,
  format: ['esm'],
  dts: true,
}
