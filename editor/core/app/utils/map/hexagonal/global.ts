import { defineHex } from 'honeycomb-grid'
import type { Sprite } from 'pixi.js'
import { config } from './config'

export const CustomHex = defineHex({ dimensions: config.grid.size, origin: 'topLeft' })
export const tilesMap = new Map<string, Sprite | 'empty'>()
