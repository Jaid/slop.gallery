import {Color, DataTexture, HalfFloatType, LinearFilter, RepeatWrapping, RGBAFormat} from 'three/webgpu'

import {groundRadius, impastoSurface, reliefLimit} from './strokes.ts'

let relief: DataTexture | undefined

/** One shared atlas of linear pigment and height above the gesso, built only if an Impasto Orb is drawn. */
export function impastoRelief() {
  if (relief) {
    return relief
  }
  const width = 1024
  const height = width / 2
  const data = new Float16Array(width * height * 4)
  const color = new Color
  const streak = new Color
  let index = 0
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height
    for (let x = 0; x < width; x++) {
      const radius = impastoSurface((x + 0.5) / width, v, color, streak)
      data[index++] = color.r
      data[index++] = color.g
      data[index++] = color.b
      data[index++] = (radius - groundRadius) / reliefLimit
    }
  }
  // Three’s HalfFloatType takes the raw FP16 bits, not a conversion to unsigned integers.
  relief = new DataTexture(new Uint16Array(data.buffer), width, height, RGBAFormat, HalfFloatType)
  relief.name = 'impasto-relief'
  relief.wrapS = RepeatWrapping
  relief.minFilter = LinearFilter
  relief.magFilter = LinearFilter
  relief.needsUpdate = true
  return relief
}
