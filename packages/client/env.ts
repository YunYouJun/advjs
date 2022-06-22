import type { AdvConfig } from '@advjs/types'
// @ts-expect-error missing types
import _configs from '/@advjs/configs'

export const config = _configs as AdvConfig
export const configs = _configs as AdvConfig
export const advConfig = _configs as AdvConfig
export const advAspect = configs.aspectRatio
export const advWidth = configs.canvasWidth
export const advHeight = Math.round(advWidth / advAspect)
