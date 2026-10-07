import advMd from './adv-md/index'
import blank from './blank/index'
import flow from './flow/index'
import rainyLetter from './rainy-letter/index'
import starter from './starter/index'

export type { ProjectTemplateDefinition, ProjectTemplateFile, ProjectTemplateMeta } from './types'

export const PROJECT_TEMPLATE_LIST = [starter, rainyLetter, advMd, blank, flow]

export const PROJECT_TEMPLATE_MAP = Object.fromEntries(
  PROJECT_TEMPLATE_LIST.map(t => [t.meta.id, t]),
)
