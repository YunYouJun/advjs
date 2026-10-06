const offline = import.meta.env?.ADVJS_OFFLINE === true

export const images = {
  yunAlphaUrl: offline ? '' : 'https://cos.advjs.yunle.fun/characters/xiaoyun/yun-alpha-compressed.png',
  yunGoodAlphaUrl: offline ? '' : 'https://cos.advjs.yunle.fun/characters/xiaoyun/yun-good-alpha-compressed.png',
  defaultBgUrl: offline ? '' : 'https://cos.advjs.yunle.fun/images/bg/stars-timing-0-blur-30px.jpg',
}
