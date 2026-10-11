import type { ThreeSceneSetup, ThreeViewport, ThreeViewportOptions } from '@advjs/plugin-three'
import type { Intersection } from 'three'
import type { MaybeRefOrGetter } from 'vue'
import { createThreeEntityRegistry, frameThreeObjects } from '@advjs/plugin-three'
import { AmbientLight, BoxGeometry, Color, DirectionalLight, GridHelper, Mesh, MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Vector3 } from 'three'
import { markRaw, toValue, watch } from 'vue'
import { bindCharacterKeyboard, createCharacterController } from './character-controller'
import { createCharacterModel } from './character-model'

export const primitives = [
  { id: 'blue', label: '蓝色方块', color: '#5798d4', x: -3, z: -1 },
  { id: 'green', label: '绿色方块', color: '#68b597', x: 0, z: 2 },
  { id: 'orange', label: '橙色方块', color: '#d8a15d', x: 3, z: -1 },
]

/** Demonstrates rendering APIs without depending on any game's rules. */
export function usePrimitiveScene(selected: MaybeRefOrGetter<string | undefined>) {
  const camera = markRaw(new OrthographicCamera(-8, 8, 6, -6, 0.1, 100))
  const entities = createThreeEntityRegistry()
  const materials = new Map<string, MeshStandardMaterial>()
  const character = createCharacterController()
  const forward = new Vector3()
  let viewport: ThreeViewport | undefined
  let player: ReturnType<typeof createCharacterModel> | undefined
  let ground: Mesh | undefined
  const frameAll = () => {
    if (viewport && player && ground)
      frameThreeObjects(viewport, [...entities.getObjects(), player.root, ground])
  }
  const options: ThreeViewportOptions = {
    camera,
    controls: true,
    continuous: true,
    pickObjects: () => entities.getObjects(),
    onResize: frameAll,
    onContextChange: () => character.clearInput(),
    onFrame(current, delta) {
      if (delta === 0)
        character.clearInput()
      current.camera.getWorldDirection(forward)
      character.update(delta, forward)
      player?.update(character.state)
    },
  }
  function highlight() {
    for (const [id, material] of materials)
      material.emissive.set(id === toValue(selected) ? '#55451f' : '#000000')
    viewport?.invalidate()
  }
  const setup: ThreeSceneSetup = (current) => {
    viewport = current
    camera.position.set(8, 12, 10)
    camera.zoom = 1
    camera.lookAt(0, 0, 0)
    current.scene.background = new Color('#23282e')
    current.scene.add(new AmbientLight('#ffffff', 2), new GridHelper(14, 14, '#606c78', '#3e4852'))
    const light = new DirectionalLight('#ffffff', 3)
    light.position.set(0, 8, 5)
    current.scene.add(light)
    ground = new Mesh(new PlaneGeometry(14, 14), new MeshStandardMaterial({ color: '#303b42', roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.015
    player = createCharacterModel()
    character.reset()
    player.update(character.state)
    current.scene.add(ground, player.root, player.shadow)
    const geometry = new BoxGeometry(1.3, 1.3, 1.3)
    for (const item of primitives) {
      const material = new MeshStandardMaterial({ color: item.color, roughness: 0.7 })
      const mesh = new Mesh(geometry, material)
      mesh.name = item.id
      mesh.position.set(item.x, 0.65, item.z)
      entities.register(item.id, mesh)
      materials.set(item.id, material)
      current.scene.add(mesh)
    }
    frameAll()
    highlight()
    const releaseKeyboard = bindCharacterKeyboard(current.renderer.domElement, character)
    return () => {
      releaseKeyboard()
      entities.clear()
      materials.clear()
      player = undefined
      ground = undefined
      viewport = undefined
    }
  }
  watch(() => toValue(selected), highlight)
  function resolvePick(hit: Intersection | undefined) {
    return entities.resolve(hit)
  }
  function resetCharacter() {
    character.reset()
    player?.update(character.state)
    viewport?.invalidate()
  }
  return { setup, options, frameAll, resolvePick, resetCharacter }
}
