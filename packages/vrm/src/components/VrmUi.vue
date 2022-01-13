<template>
  <AdvToolbox :default-status="true">
    <template #icon>
      <AdvIconButton class="fixed right-35 bottom-5">
        <i-ri-edit-line />
      </AdvIconButton>
    </template>
    <div v-show="vrmManager" class="overflow-y-auto" p="2" h="screen">
      <h2 text="lg">
        骨骼编辑
      </h2>
      <div text="left">
        <div v-for="(bone, i) in HumanBones" :key="i" m="y-1">
          <details>
            <summary>
              <h3 text="xs" class="inline-block cursor-pointer">
                {{ bone }} <small text="xs">{{ t('bones.' + bone) }}</small>
              </h3>
            </summary>

            <div class="flex justify-center items-center">
              <span class="mr-2">x:</span>
              <div class="inline-flex adv-slider-container">
                <input v-model="bonesRotation[bone].x" class="adv-slider w-40" type="range" min="0" :max="Math.PI * 2" step="0.01" text="black" @input="update(bone)">
              </div>
              <input v-model="bonesRotation[bone].x" class="adv-slider-input" step="0.1" @input="update(bone)">
            </div>
            <div class="flex justify-center items-center">
              <span class="mr-2">y:</span>
              <div class="inline-flex">
                <input v-model="bonesRotation[bone].y" class="adv-slider w-40" type="range" min="0" :max="Math.PI * 2" step="0.01" text="black" @input="update(bone)">
              </div>
              <input v-model="bonesRotation[bone].y" class="adv-slider-input" step="0.1" @input="update(bone)">
            </div>
            <div class="flex justify-center items-center">
              <span class="mr-2">z:</span>
              <div class="inline-flex">
                <input v-model="bonesRotation[bone].z" class="adv-slider w-40" type="range" min="0" :max="Math.PI * 2" step="0.01" text="black" @input="update(bone)">
              </div>
              <input v-model="bonesRotation[bone].z" class="adv-slider-input" step="0.1" @input="update(bone)">
            </div>
          </details>
        </div>
      </div>
    </div>
  </AdvToolbox>

  <AdvToolbox position="right" :default-status="true">
    <template #icon>
      <AdvIconButton class="fixed right-20 bottom-5">
        <i-ri-emotion-line />
      </AdvIconButton>
    </template>
    <div v-show="Object.keys(vrmMorphingList).length" text="left" p="2">
      <h2 text="lg center">
        预设编辑
      </h2>
      <div v-for="(_, name) in vrmMorphingList" :key="name" m="y-1">
        <div class="flex justify-center items-center">
          <span class="mr-2 w-16" text="sm">{{ name }}:</span>
          <div class="inline-flex adv-slider-container">
            <input v-model="vrmMorphingList[name]" class="adv-slider w-40" type="range" min="0" :max="1" step="0.01" text="black" @input="updateMorphing(name)">
          </div>
          <input v-model="vrmMorphingList[name]" class="adv-slider-input" min="0" :max="1" step="0.1" @input="updateMorphing(name)">
        </div>
      </div>
    </div>
  </AdvToolbox>
</template>

<script lang="ts" setup>
import type { VRMManager } from 'babylon-vrm-loader'
import * as BABYLON from '@babylonjs/core'
import type { HumanBonesType } from '@advjs/core/babylon/vrm/pose'
import { HumanBones } from '@advjs/core/babylon/vrm/pose'
import type { RawPoseData } from '@advjs/core/babylon/types'

const { t } = useI18n()

const props = defineProps<{
  vrmManager?: VRMManager
}>()

const defaultBonesRotation: Partial<RawPoseData> = {}
HumanBones.forEach((bone) => {
  defaultBonesRotation[bone] = {
    x: 0,
    y: 0,
    z: 0,
  }
})
const bonesRotation = ref<RawPoseData>(defaultBonesRotation as RawPoseData)

const vrmMorphingList = ref<Record<string, number>>({})

watch(() => props.vrmManager, (manager) => {
  if (manager) {
    HumanBones.forEach((bone) => {
      if (!manager.humanoidBone[bone]) return
      const angles = manager.humanoidBone[bone]!.rotationQuaternion?.toEulerAngles()
      bonesRotation.value[bone].x = angles?.x || 0
      bonesRotation.value[bone].y = angles?.y || 0
      bonesRotation.value[bone].z = angles?.z || 0
    })

    const list = manager.getMorphingList()
    list.forEach((name) => {
      vrmMorphingList.value[name] = 0
    })
  }
})

const update = (boneName: HumanBonesType) => {
  if (!props.vrmManager) return
  const boneRotation = bonesRotation.value[boneName]
  if (boneRotation)
    props.vrmManager.humanoidBone[boneName]!.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(boneRotation.x, boneRotation.y, boneRotation.z)
}

/**
 * 更新 Morphing
 */
const updateMorphing = (name: string) => {
  if (!props.vrmManager) return
  props.vrmManager.morphingPreset(name.toLowerCase(), vrmMorphingList.value[name])
}
</script>
