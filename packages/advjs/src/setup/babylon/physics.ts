// import * as BABYLON from '@babylonjs/core'

// getScript('https://cdn.babylonjs.com/ammo.js', '').then(() => {
// })

// todo, but we do not need it now
// export function makePhysicsObject(newMeshes, scene, scaling) {
//   // Create physics root and position it to be the center of mass for the imported mesh
//   const physicsRoot = new BABYLON.Mesh('physicsRoot', scene)
//   physicsRoot.position.y -= 0.9

//   // Add all root nodes within the loaded gltf to the physics root
//   newMeshes.forEach((m, i) => {
//     if (m.parent == null)
//       physicsRoot.addChild(m)
//   })

//   // Make every collider into a physics impostor
//   physicsRoot.getChildMeshes().forEach((m) => {
//     if (m.name.includes('box')) {
//       m.scaling.x = Math.abs(m.scaling.x)
//       m.scaling.y = Math.abs(m.scaling.y)
//       m.scaling.z = Math.abs(m.scaling.z)
//       m.physicsImpostor = new BABYLON.PhysicsImpostor(m, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0.1 }, scene)
//     }
//   })

//   // Scale the root object and turn it into a physics impsotor
//   physicsRoot.scaling.scaleInPlace(scaling)
//   physicsRoot.physicsImpostor = new BABYLON.PhysicsImpostor(physicsRoot, BABYLON.PhysicsImpostor.NoImpostor, { mass: 3 }, scene)

//   return physicsRoot
// }
