import config from '~/config'

export const advAspect = config.aspectRatio
export const advWidth = config.canvasWidth
export const advHeight = Math.round(advWidth / advAspect)
