// {
//   /**
//    * 将微信登录二维码内嵌到自己页面
//    * @see https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
//    */
//   src: 'http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js',
// },
// import { useScriptTag } from '@vueuse/core'

/**
 * login
 *
 * 关注公众号登录
 * @TODO: https://docs.authing.cn/v2/guides/connections/social/wechatmp-qrcode/
 */
export function useWxLogin() {
  // const { load } = useScriptTag(
  //   'http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js',
  //   // on script tag loaded.
  //   (_el: HTMLScriptElement) => { },
  //   { manual: true },
  // )

  return {
    async load() {
      // load script tag
      // await load()

      // let obj = new WxLogin({
      //   self_redirect: true,
      //   id: 'wx-login-container',
      //   appid: 'wxe6749827b67dfc25',
      //   scope: 'snsapi_login',
      //   redirect_uri: 'https://api.yunle.fun/wx/redirect_uri',
      //   state: 'LOGIN',
      //   style: 'white',
      //   lang: 'cn',
      //   response_type: 'code',
      //   // href: '',
      //   onReady(isReady) {
      //     console.log(isReady)
      //   },
      // })
    },
  }
}
