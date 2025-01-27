import * as BABYLON from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'

export function createSkybox(scene: BABYLON.Scene) {
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
}
