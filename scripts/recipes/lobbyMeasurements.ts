import type {ToolCall} from 'capture-page'

import {join} from 'node:path'

import snap from '../snap.ts'

const addLayer = (id: string): ToolCall => ({
  name: 'add_layer',
  input: {
    id,
    color: '#ff0000',
    lineWidth: 300,
  },
})
const line = (layer: string, from: Array<number>, to: Array<number>): ToolCall => ({
  name: 'add_drawing',
  input: {
    type: 'line',
    layer,
    from,
    to,
  },
})
const floor = 'lobby-floor-trace'
const sill = 'lobby-salon-sill-height'
const calls: Array<ToolCall> = [
  addLayer(floor),
  line(floor, [3.5149, 0, -31.8], [3.5149, 0, -28]),
  line(floor, [3.4649, 0, -31.8], [3.5649, 0, -31.8]),
  line(floor, [3.4649, 0, -28], [3.5649, 0, -28]),
  addLayer(sill),
  line(sill, [7.728, 0, -27.6], [7.728, 1.2, -27.6]),
  line(sill, [7.728, 0, -27.65], [7.728, 0, -27.55]),
  line(sill, [7.728, 1.2, -27.65], [7.728, 1.2, -27.55]),
  {
    name: 'add_text_overlay',
    input: {
      text: '380 cm',
      anchor: 7,
      position: {
        x: 3.5149,
        y: 0,
        z: -29.9,
      },
    },
  },
  {
    name: 'add_text_overlay',
    input: {
      text: '120 cm',
      anchor: 9,
      position: {
        x: 7.728,
        y: 0.6,
        z: -27.6,
      },
    },
  },
]
await snap({
  target: join(import.meta.dir, '../../dist'),
  position: '3.8,2.6,-27',
  angle: '-50,-46.7',
  fov: '90',
  seed: '0',
  paused: 'true',
  development: 'true',
  crosshair: 'always',
  settle: '5',
  'jxl-distance': '0',
  'jxl-effort': '6',
  'text-overlays': true,
}, calls)
