import { connectOBSWebSocket } from '../src'

connectOBSWebSocket({
  url: 'ws://127.0.0.1:4455',
  password: 'advjs-plugin-obs',

  inputSettings: {
    url: 'https://love.demo.advjs.org',
    fps: 60,
  },

  duration: 5000,
})
