import advMd from './adv-md/index'
import blank from './blank/index'
import flow from './flow/index'

export type { ProjectTemplateDefinition, ProjectTemplateFile, ProjectTemplateMeta } from './types'

export const PROJECT_TEMPLATE_LIST = [advMd, flow, blank]

export const PROJECT_TEMPLATE_MAP = Object.fromEntries(
  PROJECT_TEMPLATE_LIST.map(t => [t.meta.id, t]),
)
