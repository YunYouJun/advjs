<script lang="ts" setup>
import * as BABYLON from '@babylonjs/core'
import type { HumanBonesType, PoseEulerType } from '@advjs/plugin-babylon'
import { HumanBones } from '@advjs/plugin-babylon'
import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVrmStore } from '../stores/vrm'

const { t } = useI18n()

const vrmStore = useVrmStore()

const curBone = ref<HumanBonesType>()

const defaultBonesRotation: Record<keyof PoseEulerType, {
  x: Ref<number>
  y: Ref<number>
  z: Ref<number>
}>
= Object.fromEntries(
  HumanBones.map(bone => [bone as (keyof PoseEulerType), {
    x: ref(0),
    y: ref(0),
    z: ref(0),
  }]),
) as Record<keyof PoseEulerType, {
  x: Ref<number>
  y: Ref<number>
  z: Ref<number>
}>

HumanBones.forEach((bone) => {
  defaultBonesRotation[bone] = {
    x: ref(0),
    y: ref(0),
    z: ref(0),
  }
})
const bonesRotation = defaultBonesRotation

const vrmMorphingList = ref<Record<string, number>>({})

watch(() => vrmStore.vrmManager, (manager) => {
  if (manager) {
    HumanBones.forEach((bone: keyof PoseEulerType) => {
      if (!manager.humanoidBone[bone])
        return
      const angles = manager.humanoidBone[bone]!.rotationQuaternion?.toEulerAngles()
      bonesRotation[bone].x.value = BABYLON.Angle.FromRadians(angles?.x || 0).degrees()
      bonesRotation[bone].y.value = BABYLON.Angle.FromRadians(angles?.y || 0).degrees()
      bonesRotation[bone].z.value = BABYLON.Angle.FromRadians(angles?.z || 0).degrees()
    })

    const list = manager.getMorphingList()
    list.forEach((name) => {
      vrmMorphingList.value[name] = 0
    })

    const setAxis = (axis: 'x' | 'y' | 'z') => {
      if (!curBone.value)
        return
      const boneNode = vrmStore.vrmManager?.humanoidBone[curBone.value]
      const angles = boneNode?.rotationQuaternion?.toEulerAngles()
      bonesRotation[curBone.value][axis].value = BABYLON.Angle.FromRadians(angles?.[axis] || 0).degrees()
    }
    // @ts-expect-error window.babylon
    const gizmoManager = vrmStore.babylon.gizmoManager as BABYLON.GizmoManager
    const rotationGizmo = gizmoManager.gizmos.rotationGizmo
    if (!rotationGizmo)
      return
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
function updateBoneRotation(boneName: HumanBonesType, axis: 'x' | 'y' | 'z', rotation: number) {
  if (!vrmStore.vrmManager)
    return
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
function updateMorphing(name: string) {
  if (!vrmStore.vrmManager)
    return
  vrmStore.vrmManager.morphingPreset(name.toLowerCase(), vrmMorphingList.value[name])
}

/**
 * 切换 Bone
 */
function toggleBone(bone: HumanBonesType) {
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

<template>
  <AdvToolbox :default-status="true">
    <template #icon>
      <AdvIconButton class="fixed bottom-5 right-35">
        <div i-ri-edit-line />
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
                text="xs" class="inline-flex cursor-pointer items-center justify-center" :class="bone === curBone ? 'font-bold text-blue-300' : ''"
                @click="(event: any) => {
                  toggleBone(bone);event.preventDefault()
                }"
              >
                <span class="mr-1 inline-flex">
                  <div v-if="bone === curBone" i-ri-checkbox-line />
                  <div v-else i-ri-checkbox-blank-line />
                </span>
                {{ t(`bones.${bone}`) }} <small text="xs" opacity="80" class="scale-90 transform">({{ bone }})</small>
              </h3>
            </summary>

            <div v-for="axis in (['x', 'y', 'z'] as const)" :key="axis" class="flex items-center justify-center">
              <AdvSlider
                v-model="bonesRotation[bone][axis].value" :label="`${axis}:`" unit="°"
                @input="(degree: any) => { updateBoneRotation(bone, axis, degree) }"
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  </AdvToolbox>

  <AdvToolbox position="right" :default-status="true">
    <template #icon>
      <AdvIconButton class="fixed bottom-5 right-20">
        <div i-ri-emotion-line />
      </AdvIconButton>
    </template>
    <div v-show="Object.keys(vrmMorphingList).length" text="left" p="2">
      <h2 text="lg center">
        预设编辑
      </h2>
      <div v-for="(_, name) in vrmMorphingList" :key="name" m="y-1">
        <div class="flex items-center justify-center">
          <span class="mr-2 w-16" text="sm">{{ name }}:</span>
          <div class="adv-slider-container inline-flex">
            <input v-model="vrmMorphingList[name]" class="adv-slider w-40" type="range" min="0" :max="1" step="0.01" text="black" @input="updateMorphing(name)">
          </div>
          <input v-model="vrmMorphingList[name]" class="adv-slider-input" min="0" :max="1" step="0.1" @input="updateMorphing(name)">
        </div>
      </div>
    </div>
  </AdvToolbox>
</template>
