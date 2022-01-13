import { GridMaterial } from '@babylonjs/materials/Grid'
import * as BABYLON from '@babylonjs/core'

/**
 * 创建网格地面
 * @param scene
 * @returns
 */
export const createGridGround = (scene: BABYLON.Scene) => {
  // Material
  const groundMaterial = new GridMaterial('groundMaterial', scene)
  groundMaterial.majorUnitFrequency = 5
  groundMaterial.minorUnitVisibility = 0.45
  groundMaterial.gridRatio = 0.5
  groundMaterial.backFaceCulling = false
  groundMaterial.mainColor = new BABYLON.Color3(1, 1, 1)
  groundMaterial.lineColor = new BABYLON.Color3(1.0, 1.0, 1.0)
  groundMaterial.opacity = 0.98

  // Ground
  const ground = BABYLON.MeshBuilder.CreatePlane('ground', {
    size: 10,
  }, scene)
  ground.position = new BABYLON.Vector3(0, 0, 0)
  ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0)
  ground.material = groundMaterial

  return ground
}
