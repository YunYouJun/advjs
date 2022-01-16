<template>
  <AdvToolbox :default-status="true">
    <template #icon>
      <AdvIconButton class="fixed right-35 bottom-5">
        <i-ri-edit-line />
      </AdvIconButton>
    </template>
    <div v-show="vrmStore.vrmManager" class="overflow-y-auto" p="2" h="screen">
      <h2 text="lg">
        骨骼编辑
      </h2>
      <div text="left">
        <div v-for="(bone, i) in HumanBones" :key="i" m="y-1">
          <details>
            <summary>
              <h3
                text="xs" class="inline-flex cursor-pointer justify-center items-center" :class="bone === curBone ? 'font-bold text-blue-300' : ''" @click="(event)=>{
                  toggleBone(bone);event.preventDefault()
                }"
              >
                <span class="mr-1 inline-flex">
                  <i-ri-checkbox-line v-if="bone === curBone" />
                  <i-ri-checkbox-blank-line v-else />
                </span>
                {{ t('bones.' + bone) }} <small text="xs" opacity="80" class="transform scale-90">({{ bone }})</small>
              </h3>
            </summary>

            <div v-for="axis in (['x', 'y', 'z'] as const)" :key="axis" class="flex justify-center items-center">
              <AdvSlider v-model="bonesRotation[bone][axis]" :label="axis+':'" @input="(degree)=>{updateBoneRotation(bone, axis, degree)}" />
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
import * as BABYLON from '@babylonjs/core'
import type { HumanBonesType } from '@advjs/core/babylon/vrm/pose'
import { HumanBones } from '@advjs/core/babylon/vrm/pose'
import type { PoseEulerType } from '@advjs/core/babylon/types'
import { useVrmStore } from '../stores/vrm'

const { t } = useI18n()

const vrmStore = useVrmStore()

const curBone = ref<HumanBonesType>()

const defaultBonesRotation: Partial<PoseEulerType> = {}
HumanBones.forEach((bone) => {
  defaultBonesRotation[bone] = {
    x: 0,
    y: 0,
    z: 0,
  }
})
const bonesRotation = ref<PoseEulerType>(defaultBonesRotation as PoseEulerType)

const vrmMorphingList = ref<Record<string, number>>({})

watch(() => vrmStore.vrmManager, (manager) => {
  if (manager) {
    HumanBones.forEach((bone) => {
      if (!manager.humanoidBone[bone]) return
      const angles = manager.humanoidBone[bone]!.rotationQuaternion?.toEulerAngles()
      bonesRotation.value[bone].x = BABYLON.Angle.FromRadians(angles?.x || 0).degrees()
      bonesRotation.value[bone].y = BABYLON.Angle.FromRadians(angles?.y || 0).degrees()
      bonesRotation.value[bone].z = BABYLON.Angle.FromRadians(angles?.z || 0).degrees()
    })

    const list = manager.getMorphingList()
    list.forEach((name) => {
      vrmMorphingList.value[name] = 0
    })

    const setAxis = (axis: 'x' | 'y' | 'z') => {
      if (!curBone.value) return
      const boneNode = vrmStore.vrmManager?.humanoidBone[curBone.value]
      const angles = boneNode?.rotationQuaternion?.toEulerAngles()
      bonesRotation.value[curBone.value][axis] = BABYLON.Angle.FromRadians(angles?.[axis] || 0).degrees()
    }
    // @ts-expect-error window.babylon
    const gizmoManager = vrmStore.babylon.gizmoManager as BABYLON.GizmoManager
    const rotationGizmo = gizmoManager.gizmos.rotationGizmo
    if (!rotationGizmo) return
    rotationGizmo.xGizmo.dragBehavior.onDragObservable.add(() => setAxis('x'))
    rotationGizmo.yGizmo.dragBehavior.onDragObservable.add(() => setAxis('y'))
    rotationGizmo.zGizmo.dragBehavior.onDragObservable.add(() => setAxis('z'))
  }
})

/**
 *
 * @param boneName
 * @param axis
 * @param rotation degree
 */
const updateBoneRotation = (boneName: HumanBonesType, axis: 'x' | 'y' | 'z', rotation: number) => {
  if (!vrmStore.vrmManager) return
  const boneRotation = vrmStore.vrmManager.humanoidBone[boneName]!.rotation
  const radian = BABYLON.Angle.FromDegrees(rotation).radians()
  vrmStore.vrmManager.humanoidBone[boneName]!.rotation = new BABYLON.Vector3(
    axis === 'x' ? radian : boneRotation.x,
    axis === 'y' ? radian : boneRotation.y,
    axis === 'z' ? radian : boneRotation.z,
  )
}

/**
 * 更新 Morphing
 */
const updateMorphing = (name: string) => {
  if (!vrmStore.vrmManager) return
  vrmStore.vrmManager.morphingPreset(name.toLowerCase(), vrmMorphingList.value[name])
}

/**
 * 切换 Bone
 */
const toggleBone = (bone: HumanBonesType) => {
  // @ts-expect-error window.babylon
  const gizmoManager = vrmStore.babylon.gizmoManager as BABYLON.GizmoManager
  if (curBone.value === bone) {
    curBone.value = undefined
    gizmoManager.rotationGizmoEnabled = false
  }
  else {
    curBone.value = bone

    gizmoManager.rotationGizmoEnabled = true
    const boneNode = vrmStore.vrmManager?.humanoidBone[bone]
    gizmoManager.attachToMesh((boneNode as BABYLON.AbstractMesh))
  }
}
</script>
