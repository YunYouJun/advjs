import { useAdvStore } from '../store'

export function useCamera() {
  const store = useAdvStore()
  return {
    handle() {
      store.cur.dialog = {
        type: 'dialog',
        character: {
          type: 'character',
          name: '',
          status: '',
        },
        children: [
          {
            type: 'text',
            value: '（镜头动画）',
          },
        ],
      }
    },
  }
}
