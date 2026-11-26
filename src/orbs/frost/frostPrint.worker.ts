import type {PrintRequest} from './frostPrint.ts'

import {mulberry32} from 'math/random'

globalThis.addEventListener('message', ({data: {image, seed}}: MessageEvent<PrintRequest>) => {
  const canvas = new OffscreenCanvas(image.width, image.height)
  const paper = canvas.getContext('2d')!
  try {
    paper.drawImage(image, 0, 0)
  } finally {
    image.close()
  }
  frostPrint(paper, seed)
  const print = canvas.transferToImageBitmap()
  globalThis.postMessage(print, {transfer: [print]})
})
/** A winter photogravure when no image model is connected: silver rime on the work’s own light-facing contours, ice flowers in the margins and three depths of blowing snow. */
function frostPrint(paper: OffscreenCanvasRenderingContext2D, seed: number) {
  const random = mulberry32.create(seed)
  const roll = () => mulberry32.sample(random)
  settleSnow(paper, roll)
  const short = Math.min(paper.canvas.width, paper.canvas.height)
  const w = paper.canvas.width / short
  const h = paper.canvas.height / short
  paper.save()
  paper.scale(short, short)
  // The back of the squall is fine powder. Slivers nearby catch the wind and streak diagonally across the subject.
  for (const [density, scale] of [[720, 1], [230, 2.1], [47, 3.6]]) {
    const count = Math.ceil(w * h * density)
    for (let i = 0; i < count; i++) {
      const x = roll() * w
      const y = roll() * h
      const r = (0.00052 + 0.00082 * roll()) * scale
      paper.beginPath()
      paper.ellipse(x, y, r * (1.15 + roll() * 2.3), r * 0.63, 0.54 + 0.19 * Math.sin(y * 7) + 0.13 * roll(), 0, 2 * Math.PI)
      paper.fillStyle = `rgb(239 251 255 / ${0.18 + 0.68 * roll()})`
      paper.fill()
    }
  }
  paper.restore()
}
/** The coat goes on a small plate so the original strokes keep their resolution and making it never needs a full-size pixel readback. */
function settleSnow(paper: OffscreenCanvasRenderingContext2D, roll: () => number) {
  const {width, height} = paper.canvas
  const scale = Math.min(1, 960 / Math.max(width, height))
  const plate = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
  const ctx = plate.getContext('2d', {willReadFrequently: true})!
  const {width: w, height: h} = plate
  ctx.drawImage(paper.canvas, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  const light = new Uint8Array(w * h)
  for (let i = 0; i < light.length; i++) {
    light[i] = (data[4 * i] * 3 + data[4 * i + 1] * 6 + data[4 * i + 2]) / 10
  }
  // Each nucleus grows a fan of curved needles at its own angle until it meets its neighbors, like frost flowers on a cold pane.
  const short = Math.min(w, h)
  const span = Math.max(16, short * 0.15)
  const cols = Math.ceil(w / span) + 2
  const seeds = Array.from({length: cols * (Math.ceil(h / span) + 2)}, (_, i) => {
    const angle = roll() * 2 * Math.PI
    return {
      x: i % cols - 1 + roll(),
      y: Math.floor(i / cols) - 1 + roll(),
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      pitch: 11 + roll() * 9,
    }
  })
  for (let y = 0; y < h; y++) {
    const gy = y / span
    for (let x = 0; x < w; x++) {
      const gx = x / span
      let distance = Infinity
      let nucleus = seeds[0]
      for (let row = 0; row < 3; row++) {
        const start = (Math.floor(gy) + row) * cols + Math.floor(gx)
        for (let col = 0; col < 3; col++) {
          const candidate = seeds[start + col]
          const d = (gx - candidate.x) ** 2 + (gy - candidate.y) ** 2
          if (!(d < distance)) {
            continue
          }
          distance = d
          nucleus = candidate
        }
      }
      const dx = gx - nucleus.x
      const dy = gy - nucleus.y
      const along = dx * nucleus.cos + dy * nucleus.sin
      const across = Math.abs(dy * nucleus.cos - dx * nucleus.sin - along * along * 0.42)
      const phase = (along - across * (0.74 - along * 0.78) + across * across * 0.32) * nucleus.pitch
      const ridge = (1 - Math.abs(phase - Math.round(phase)) * 2) ** 3
      const keel = Math.max(0, 1 - across * 30)
      const needle = Math.max(ridge, keel)
      // Treat the pigment like shallow relief: the upwind lip catches snow, while the lee stays dark. Broader patches settle in the highlights and creep in from the edges.
      const i = y * w + x
      const reach = Math.max(1, Math.round(short * (0.004 + 0.005 * needle)))
      const above = light[Math.max(0, y - reach) * w + Math.max(0, x - 1)]
      const below = light[Math.min(h - 1, y + reach) * w + Math.min(w - 1, x + 1)]
      const shelf = Math.min(1, Math.max(0, above - light[i] - 6, light[i] - below - 6) / 55)
      const margin = Math.max(0, 1 - Math.min(x, y, w - 1 - x, h - 1 - y) / (short * (0.045 + 0.18 * distance)))
      const sun = Math.max(0, (light[i] - 45) / 186)
      const coverage = Math.min(1, shelf * 0.95 + sun * sun * 0.9 + margin * (0.35 + needle * 0.72))
      const facet = Math.min(1, needle * 0.65 + shelf * 0.31 + sun * 0.46 + roll() * 0.13)
      data[4 * i] = 127 + 126 * facet
      data[4 * i + 1] = 176 + 78 * facet
      data[4 * i + 2] = 206 + 49 * facet
      data[4 * i + 3] = 255 * coverage
    }
  }
  ctx.putImageData(image, 0, 0)
  paper.drawImage(plate, 0, 0, width, height)
}
