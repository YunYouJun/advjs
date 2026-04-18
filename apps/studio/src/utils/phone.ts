/**
 * Phone number utilities for SMS login.
 * Shared with yunle.fun (云乐坊).
 */

export const areaCodes = [
  { code: '+86', name: '中国大陆', flag: '🇨🇳' },
  { code: '+1', name: '美国', flag: '🇺🇸' },
  { code: '+852', name: '中国香港', flag: '🇭🇰' },
  { code: '+853', name: '中国澳门', flag: '🇲🇴' },
  { code: '+886', name: '中国台湾', flag: '🇹🇼' },
  { code: '+81', name: '日本', flag: '🇯🇵' },
  { code: '+82', name: '韩国', flag: '🇰🇷' },
  { code: '+65', name: '新加坡', flag: '🇸🇬' },
  { code: '+60', name: '马来西亚', flag: '🇲🇾' },
  { code: '+44', name: '英国', flag: '🇬🇧' },
  { code: '+33', name: '法国', flag: '🇫🇷' },
  { code: '+49', name: '德国', flag: '🇩🇪' },
  { code: '+61', name: '澳大利亚', flag: '🇦🇺' },
  { code: '+64', name: '新西兰', flag: '🇳🇿' },
]

const RE_CN = /^1\d{10}$/
const RE_US = /^\d{10}$/
const RE_HK = /^\d{8}$/
const RE_MO = /^\d{8}$/
const RE_TW = /^\d{9}$/
const RE_JP = /^\d{10,11}$/
const RE_KR = /^\d{9,10}$/
const RE_SG = /^\d{8}$/
const RE_MY = /^\d{9,10}$/
const RE_UK = /^\d{10,11}$/
const RE_FR = /^\d{9}$/
const RE_DE = /^\d{10,11}$/
const RE_AU = /^\d{9}$/
const RE_NZ = /^\d{8,9}$/
const RE_DEFAULT = /^\d{6,}$/

export function isValidPhone(areaCode: string, phone: string): boolean {
  switch (areaCode) {
    case '+86': return RE_CN.test(phone)
    case '+1': return RE_US.test(phone)
    case '+852': return RE_HK.test(phone)
    case '+853': return RE_MO.test(phone)
    case '+886': return RE_TW.test(phone)
    case '+81': return RE_JP.test(phone)
    case '+82': return RE_KR.test(phone)
    case '+65': return RE_SG.test(phone)
    case '+60': return RE_MY.test(phone)
    case '+44': return RE_UK.test(phone)
    case '+33': return RE_FR.test(phone)
    case '+49': return RE_DE.test(phone)
    case '+61': return RE_AU.test(phone)
    case '+64': return RE_NZ.test(phone)
    default: return RE_DEFAULT.test(phone)
  }
}

export function getMaxLength(areaCode: string): number {
  switch (areaCode) {
    case '+86': return 11
    case '+1': return 10
    case '+852': return 8
    case '+853': return 8
    case '+886': return 9
    case '+81': return 11
    case '+82': return 10
    case '+65': return 8
    case '+60': return 10
    case '+44': return 11
    case '+33': return 9
    case '+49': return 11
    case '+61': return 9
    case '+64': return 9
    default: return 15
  }
}
