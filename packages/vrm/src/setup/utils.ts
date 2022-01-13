import * as BABYLON from '@babylonjs/core'

/**
 * 选中网格
 * @param scene
 * pick mesh by light cast
 * https://doc.babylonjs.com/divingDeeper/mesh/interactions/picking_collisions
 */
export const createPickMesh = (scene: BABYLON.Scene) => {
  scene.onPointerDown = function castRay() {
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), scene.activeCamera)
    const hit = scene.pickWithRay(ray)
    // eslint-disable-next-line no-console
    console.log(hit)
  }
}

export const createGizmoManager = (scene: BABYLON.Scene) => {
  // for vrm rotation
  // Create utility layer the gizmo will be rendered on
  const utilLayer = new BABYLON.UtilityLayerRenderer(scene)
  // const gizmo = new BABYLON.RotationGizmo(utilLayer)

  // const gizmoManager = new BABYLON.GizmoManager(scene)
  const gizmoManager = new BABYLON.GizmoManager(scene, undefined, utilLayer)
  // gizmoManager.positionGizmoEnabled = true
  gizmoManager.rotationGizmoEnabled = true
  gizmoManager.usePointerToAttachGizmos = false

  // gizmoManager.boundingBoxGizmoEnabled = true

  // Keep the gizmo fixed to world rotation
  // gizmo.updateGizmoRotationToMatchAttachedMesh = false
  // gizmo.updateGizmoPositionToMatchAttachedMesh = true

  // Toggle gizmos with keyboard buttons
  document.onkeydown = (e) => {
    if (e.key === 'p')
      gizmoManager.positionGizmoEnabled = !gizmoManager.positionGizmoEnabled

    if (e.key === 'r')
      gizmoManager.rotationGizmoEnabled = !gizmoManager.rotationGizmoEnabled
  }

  return gizmoManager
}
