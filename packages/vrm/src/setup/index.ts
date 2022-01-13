/* eslint-disable @typescript-eslint/no-unused-vars */
import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'
import type { VRMManager } from 'babylon-vrm-loader'
import { GridMaterial } from '@babylonjs/materials/Grid'
import { createVRMScene, getVrmManager } from '@advjs/core/babylon/vrm'
import { createGridGround } from '@advjs/core/babylon/scene'

// https://doc.babylonjs.com/divingDeeper/cameras/multiViewsPart2
/**
 * 创建坐标轴
 * @param scene
 * @param length
 * @param parent
 * @returns
 */
export const createAxes = (scene: BABYLON.Scene, length: number, parent?: BABYLON.Mesh) => {
  const axes = new BABYLON.AxesViewer(scene, length)

  if (parent) {
    axes.xAxis.parent = parent
    axes.yAxis.parent = parent
    axes.zAxis.parent = parent
  }

  return axes
}

// todo: extract canvas element
export async function setup(canvas: HTMLCanvasElement, onVRMLoaded?: (vrmManager: VRMManager) => void) {
  await import('babylon-vrm-loader')

  // Load the 3D engine
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })

  // a new scene for vrm
  const scene = createVRMScene(engine, () => {
    // on vrm loaded
    const vrmManager = getVrmManager(scene)

    if (onVRMLoaded)
      onVRMLoaded(vrmManager)

    // create axes for sce
    // createAxes(scene, 1, vrmManager.rootMesh)
  })

  // axes camera
  // const camera = new BABYLON.ArcRotateCamera('helper-camera', -Math.PI / 2, Math.PI / 2, 3, new BABYLON.Vector3(0, 1, 0), scene)
  // camera.attachControl(engine.getRenderingCanvas, true)
  // camera.viewport = new BABYLON.Viewport(0.85, 0.1, 0.15, 0.2)
  // scene.activeCameras?.push(camera)

  // create world axes
  createAxes(scene, 0.5)

  createGridGround(scene)

  // Create a skybox
  const skyMaterial = new GridMaterial('skyMaterial', scene)
  skyMaterial.majorUnitFrequency = 6
  skyMaterial.minorUnitVisibility = 0.43
  skyMaterial.gridRatio = 0.5
  skyMaterial.mainColor = new BABYLON.Color3(0, 0.05, 0.2)
  skyMaterial.lineColor = new BABYLON.Color3(0, 1.0, 1.0)
  skyMaterial.backFaceCulling = false

  const skySphere = BABYLON.MeshBuilder.CreateSphere('skySphere', {
    segments: 20,
    diameter: 100,
  }, scene)
  skySphere.material = skyMaterial

  let autoRotate = true

  // run the render loop
  engine.runRenderLoop(() => {
    const camera = scene.activeCamera as BABYLON.ArcRotateCamera

    window.addEventListener('click', () => {
      autoRotate = false
    })
    if (autoRotate) camera.alpha += 0.003

    scene.render()
  })

  // the canvas/window resize event handler
  window.addEventListener('resize', () => {
    engine.resize()
  })

  return {
    engine,
    scene,
  }
}
