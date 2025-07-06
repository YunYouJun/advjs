/**
 * 自定义模版引擎渲染
 *
 * 支持 {{ variable }} 变量替换
 * dify 社区工具一般使用 jinja {{ variable }} 语法
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const value = variables[key.trim()]
    return value !== undefined ? String(value) : ''
  })
}
