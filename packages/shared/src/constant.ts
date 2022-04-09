import { isDev } from './utils'

export const cdnPrefix = 'https://v.yyj.moe'
export const demoVrm = {
  rootUrl: `${isDev ? '' : cdnPrefix}/models/vrm/`,
  name: 'alicia-solid.vrm',
  // name: 'AvatarSample_F.vrm',
}
