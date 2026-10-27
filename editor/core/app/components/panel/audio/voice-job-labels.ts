/** Safe presentation labels for durable job codes, never provider exception text. */
export const voiceJobErrorLabels: Readonly<Record<string, string>> = {
  STORE_CAPACITY_EXCEEDED: '恢复记录空间不足，尚未调用模型',
}

export function voiceJobBlockedReason(code?: string): string {
  return code && Object.hasOwn(voiceJobErrorLabels, code) ? voiceJobErrorLabels[code]! : '任务已阻断，请检查项目配置或输入后继续。'
}
