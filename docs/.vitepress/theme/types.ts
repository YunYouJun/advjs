export interface Header {
  level: number
  title: string
  slug: string
}

export interface PageData {
  relativePath: string
  title: string
  description: string
  headers: Header[]
  frontmatter: Record<string, any>
  lastUpdated: number
}
