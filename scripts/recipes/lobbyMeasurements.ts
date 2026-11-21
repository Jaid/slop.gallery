import type {ToolCall} from 'capture-page'

import {join} from 'node:path'

// Afna1d5u2TRepqF · 21 Nov 2026 12:00. The dump uses radians; snap takes yaw,pitch in degrees.
const angle = [-0.8729, -0.8156].map(value => value * 180 / Math.PI).join(',')
const addLayer = (id: string): ToolCall => ({
  name: 'add_layer',
  input: {
    id,
    color: '#ff3636',
    lineWidth: 340,
  },
})
const line = (layer: string, from: Array<number>, to: Array<number>): ToolCall => ({
  name: 'add_drawing',
  input: {drawing: {
    type: 'line',
    layer,
    from,
    to,
  }},
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
      text: '3.80 m',
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
      text: '1.20 m',
      anchor: 9,
      position: {
        x: 7.728,
        y: 0.6,
        z: -27.6,
      },
    },
  },
]
await Bun.$`bun scripts/snap.ts --target dist --position=3.799,2.619,-27.048 --angle=${angle} --fov 90 --height 2160 --seed 0 --paused true --development true --crosshair always --settle 5 --jxl-distance 0 --jxl-effort 6 --name lobby-measurements-1200 --text-overlays --tools ${JSON.stringify(calls)}`.cwd(join(import.meta.dir, '..', '..'))
