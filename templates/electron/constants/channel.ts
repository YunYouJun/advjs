export const channels = [
  'quit-app', // Quit the application
] as const

export type CHANNEL = typeof channels[number]
