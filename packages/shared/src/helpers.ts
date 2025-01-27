/**
 * 加载脚本
 * @param url 脚本链接
 */
export async function getScript(url: string, type = 'module') {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    if (type)
      script.type = type
    script.onload = () => {
      resolve(true)
    }
    script.onerror = () => {
      reject(new Error('Script 加载失败'))
    }
    script.src = url
    document.body.appendChild(script)
  })
}
