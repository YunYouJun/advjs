# @advjs/plugin-three

Reusable browser rendering infrastructure for ADV.JS games using Three.js: a Vue canvas component, perspective or orthographic camera, optional OrbitControls, raycasting, on-demand rendering, and resource cleanup.

Game rules belong in a separate runtime plugin. This package does not register activities, load a map automatically, or add an Editor panel.

- Vue component: `@advjs/plugin-three/client/AdvThreeCanvas.vue`
- Browser API: `createThreeViewport`, `disposeThreeResources`, `createThreeEntityRegistry`, `frameThreeObjects`
- [Integration and ownership guide](../../docs/guide/runtime/three.md)
- [Runnable rendering example](../../examples/three-map/README.md)

```bash
pnpm -C plugins/plugin-three build
pnpm exec vitest run plugins/plugin-three/test
```

The consuming app supplies Vue 3 and Three.js (currently tested with `three@0.183.2`). TypeScript consumers also need `@types/three`. Import the Vue component through a Vue-aware bundler; import the browser API only in a browser or after mounting.
