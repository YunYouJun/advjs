<template>
  <div class="w-full h-full">
    <canvas ref="babylonCanvas" class="w-full h-full outline-none" />
  </div>
</template>

<script lang="ts" setup>
import * as BABYLON from '@babylonjs/core'
import { isClient } from '@advjs/shared/utils'
import { setup } from '~/setup/babylon'
import { adv } from '~/setup/adv'
import { useBabylonStore } from '~/stores/babylon'

const bStore = useBabylonStore()

const babylonCanvas = ref()

onMounted(async() => {
  if (!isClient) return
  const instance = await setup(babylonCanvas.value)
  bStore.setInstance(instance)
})

const curNode = computed(() => {
  return adv.store.curNode.value
})

watch(() => curNode.value, () => {
  if (curNode.value && curNode.value.type === 'camera' && bStore.instance) {
    const scene = bStore.instance.scene
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

    if (curNode.value.target) {
      const targetPosition = curNode.value.target
      generateCameraAnimation('target', BABYLON.Animation.ANIMATIONTYPE_VECTOR3, new BABYLON.Vector3(targetPosition.x, targetPosition.y, targetPosition.z))
    }

    if (curNode.value.alpha)
      generateCameraAnimation('alpha', BABYLON.Animation.ANIMATIONTYPE_FLOAT, curNode.value.alpha)

    if (curNode.value.beta)
      generateCameraAnimation('beta', BABYLON.Animation.ANIMATIONTYPE_FLOAT, curNode.value.beta)

    if (curNode.value.radius)
      generateCameraAnimation('radius', BABYLON.Animation.ANIMATIONTYPE_FLOAT, curNode.value.radius)

    scene.beginAnimation(camera, 0, frameRate, false)
  }
})
</script>
