import type * as BABYLON from '@babylonjs/core'

export interface CameraInfo {
  target: {
    x: number
    y: number
    z: number
  }
  alpha: number
  beta: number
  radius: number
}

/**
 * 捕获相机信息
 * @param camera
 * @returns
 */
export const captureCameraInfo = (camera: BABYLON.ArcRotateCamera) => {
  const cameraInfo: CameraInfo = {
    target: {
      x: 0,
      y: 0,
      z: 0,
    },
    alpha: 0,
    beta: 0,
    radius: 0,
  }
  cameraInfo.target.x = camera.target.x
  cameraInfo.target.y = camera.target.y
  cameraInfo.target.z = camera.target.z

  cameraInfo.alpha = camera.alpha
  cameraInfo.beta = camera.beta
  cameraInfo.radius = camera.radius
  return cameraInfo
}
