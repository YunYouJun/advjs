import * as BABYLON from '@babylonjs/core'

export const createRotatePointLight = (scene: BABYLON.Scene) => {
  // create a Center of Transformation
  const CoT = new BABYLON.TransformNode('root')

  // Light to Rotate
  const light = new BABYLON.PointLight('rotatePointLight', new BABYLON.Vector3(1, 1.6, 0), scene)

  const material = new BABYLON.StandardMaterial('mat', scene)
  material.diffuseColor = BABYLON.Color3.Black()
  material.emissiveColor = BABYLON.Color3.White()
  material.alpha = 0.6

  // create sphere to indicate position of Center of Transformation
  const sphere = BABYLON.MeshBuilder.CreateSphere('pointLightSphere', { diameter: 0.1 }, scene)
  sphere.material = material

  sphere.parent = light
  light.parent = CoT

  // Animation
  let angle = 0
  scene.registerBeforeRender(() => {
    CoT.rotation.y = angle
    angle += 0.02
  })

  return CoT
}
