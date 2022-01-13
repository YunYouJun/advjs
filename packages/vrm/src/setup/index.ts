/* eslint-disable @typescript-eslint/no-unused-vars */
import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'
import type { VRMManager } from 'babylon-vrm-loader'

import { HumanBones, createVRM, createVRMScene, getVrmManager } from '@advjs/core/babylon/vrm'
import { createGridGround } from '@advjs/core/babylon/scene'
import { createRotatePointLight } from '@advjs/core/babylon/light'
import { createArcRotateCamera } from '@advjs/core/babylon/camera'
import { createSkybox } from './scene'
import { createGizmoManager } from './utils'

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

  const scene = createVRMScene(engine)
  const gizmoManager = createGizmoManager(scene)

  createVRM(scene, () => {
    // on vrm loaded
    const vrmManager = getVrmManager(scene)

    if (onVRMLoaded)
      onVRMLoaded(vrmManager)

    // create axes for sce
    // createAxes(scene, 1, vrmManager.rootMesh)
    // const boneMeshes: BABYLON.AbstractMesh[] = HumanBones.map((boneName) => {
    //   const bone = vrmManager.humanoidBone[boneName] as BABYLON.AbstractMesh
    //   bone.showBoundingBox = true
    //   return bone as BABYLON.AbstractMesh
    // })
    // Restrict gizmos to only bones
    // gizmoManager.attachableMeshes = boneMeshes
    // createPickMesh(scene)
  })

  createArcRotateCamera(scene)

  // axes camera
  // const camera = new BABYLON.ArcRotateCamera('helper-camera', -Math.PI / 2, Math.PI / 2, 3, new BABYLON.Vector3(0, 1, 0), scene)
  // camera.attachControl(null, true)
  // camera.viewport = new BABYLON.Viewport(0.85, 0.1, 0.15, 0.2)
  // scene.activeCameras?.push(camera)

  // create world axes
  // createAxes(scene, 0.5)

  createGridGround(scene)
  createRotatePointLight(scene)
  createSkybox(scene)

  let autoRotate = false

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
    gizmoManager,
  }
}
