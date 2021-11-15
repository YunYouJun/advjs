/**
 * 加载脚本
 * @param url 脚本链接
 * @returns
 */
export async function getScript(url: string) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.onload = () => {
      resolve(true)
    }
    script.onerror = () => {
      reject(Error('Script 加载失败'))
    }
    script.src = url
    document.body.appendChild(script)
  })
}
