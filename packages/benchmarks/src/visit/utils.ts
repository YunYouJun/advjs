/**
 * 测试性能
 * @param name 名称
 * @param callback 函数
 * @returns
 */
export function testPerformance(name: string, callback: Function) {
  const startTime = performance.now()
  const count = callback()
  const endTime = performance.now()
  const duration = endTime - startTime
  return {
    name,
    time: duration,
    count,
  }
}
