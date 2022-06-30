import * as BABYLON from '@babylonjs/core'
import type { AdvAst } from '@advjs/types'

/**
 * create camera animation by code operation node
 * @param scene
 * @param node
 */
export function createCameraAnimation(scene: BABYLON.Scene, node: AdvAst.Camera) {
  const camera = (scene.activeCamera as BABYLON.ArcRotateCamera)

  const frameRate = 30

  function generateCameraAnimation(name: 'alpha' | 'beta' | 'target' | 'radius', dataType: number, to: number | BABYLON.Vector3) {
    const animation = new BABYLON.Animation(`${name}Animation`, name, frameRate, dataType, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT)
    const keyFrames = []
    // const isVector3 = dataType === BABYLON.Animation.ANIMATIONTYPE_VECTOR3

    keyFrames.push({
      frame: 0,
      value: camera[name],
    })
    keyFrames.push({
      frame: frameRate,
      value: to,
    })

    animation.setKeys(keyFrames)
    camera.animations.push(animation)
  }

  if (node.target) {
    const targetPosition = node.target
    generateCameraAnimation('target', BABYLON.Animation.ANIMATIONTYPE_VECTOR3, new BABYLON.Vector3(targetPosition.x, targetPosition.y, targetPosition.z))
  }

  if (node.alpha)
    generateCameraAnimation('alpha', BABYLON.Animation.ANIMATIONTYPE_FLOAT, node.alpha)

  if (node.beta)
    generateCameraAnimation('beta', BABYLON.Animation.ANIMATIONTYPE_FLOAT, node.beta)

  if (node.radius)
    generateCameraAnimation('radius', BABYLON.Animation.ANIMATIONTYPE_FLOAT, node.radius)

  return {
    play: () => {
      scene.beginAnimation(camera, 0, frameRate, false)
    },
  }
}
