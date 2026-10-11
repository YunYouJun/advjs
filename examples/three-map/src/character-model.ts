import type { CharacterState } from './character-controller'
import { BoxGeometry, CapsuleGeometry, CircleGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three'

/** A small procedural avatar keeps the control example independent of assets. */
export function createCharacterModel() {
  const root = new Group()
  root.name = 'player'
  const coat = new MeshStandardMaterial({ color: '#e9cf87', roughness: 0.8 })
  const skin = new MeshStandardMaterial({ color: '#f4dfcb', roughness: 0.8 })
  const dark = new MeshStandardMaterial({ color: '#354759', roughness: 0.8 })
  const torso = new Mesh(new CapsuleGeometry(0.22, 0.35, 4, 8), coat)
  torso.position.y = 0.92
  const head = new Mesh(new SphereGeometry(0.2, 12, 8), skin)
  head.position.y = 1.48
  const face = new Mesh(new BoxGeometry(0.21, 0.06, 0.05), dark)
  face.position.set(0, 1.5, 0.18)
  root.add(torso, head, face)
  const limbs: Group[] = []
  for (const side of [-1, 1]) {
    const leg = new Group()
    leg.position.set(side * 0.13, 0.65, 0)
    const legMesh = new Mesh(new CapsuleGeometry(0.08, 0.38, 4, 8), dark)
    legMesh.position.y = -0.3
    leg.add(legMesh)
    const arm = new Group()
    arm.position.set(side * 0.31, 1.13, 0)
    const armMesh = new Mesh(new CapsuleGeometry(0.065, 0.3, 4, 8), coat)
    armMesh.position.y = -0.2
    arm.add(armMesh)
    root.add(leg, arm)
    limbs.push(leg, arm)
  }
  const shadow = new Mesh(new CircleGeometry(0.36, 24), new MeshBasicMaterial({ color: '#101820', transparent: true, opacity: 0.4, depthWrite: false }))
  shadow.rotation.x = -Math.PI / 2

  function update(state: Readonly<CharacterState>) {
    root.position.set(state.x, state.y, state.z)
    root.rotation.y = state.heading
    shadow.position.set(state.x, 0.005, state.z)
    shadow.scale.setScalar(1 + state.y * 0.2)
    const stride = state.grounded && state.moving ? Math.sin(state.distance * 8) * 0.5 : 0
    limbs.forEach((limb, index) => {
      limb.rotation.x = stride * (index === 0 || index === 3 ? 1 : -1)
    })
  }
  return { root, shadow, update }
}
