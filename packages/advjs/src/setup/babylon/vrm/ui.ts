// https://vrm.dev/en/docs/univrm/blendshape/univrm_blendshape/
// https://pixiv.github.io/three-vrm/docs/classes/vrmblendshapeproxy.html#blendshapepresetmap
// we can get it by manager.getMorphingList()
export const MorphingPresets = ['Neutral', 'A', 'I', 'U', 'E', 'O', 'Blink', 'Blink_L', 'Blink_R', 'Angry', 'Fun', 'Joy', 'Sorrow', 'Surprised'] as const
export type MorphingPresetType = typeof MorphingPresets[number]
