// find ./dist -type f -exec sed -i '' 's|file://||g' {} \\;
import fs from 'node:fs'
import path from 'node:path'
import consola from 'consola'

// ESM
const __dirname = path.dirname(new URL(import.meta.url).pathname)
const directoryPath = path.join(__dirname, '../dist')

// 递归遍历目录中的所有文件
function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f)
    const isDirectory = fs.statSync(dirPath).isDirectory()
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f))
  })
}

// 替换文件内容
function replaceFileContent(filePath: string) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err)
      throw err

    const result = data.replace(/file:\/\//g, '')

    fs.writeFile(filePath, result, 'utf8', (err) => {
      if (err)
        throw err

      consola.success(`Updated file: ${filePath}`)
    })
  })
}

// 开始执行替换操作
walkDir(directoryPath, replaceFileContent)
