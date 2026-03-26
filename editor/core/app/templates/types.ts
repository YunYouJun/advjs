export interface ProjectTemplateMeta {
  id: string
  name: string
  desc: string
  icon: string
}

/** 模板中需要写入目标目录的文件 */
export interface ProjectTemplateFile {
  /** 写入的文件名 */
  name: string
  /** 文件原始内容（支持 {{projectName}} 占位符） */
  content: string
  /** 是否为编辑器入口文件（setEntryFileHandle） */
  isEntry?: boolean
  /** 是否为 adv 配置文件（setAdvConfigFileHandle） */
  isAdvConfig?: boolean
}

export interface ProjectTemplateDefinition {
  meta: ProjectTemplateMeta
  files: ProjectTemplateFile[]
}
