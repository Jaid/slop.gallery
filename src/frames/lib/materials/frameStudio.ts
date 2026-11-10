import {DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RepeatWrapping, RGBAFormat} from 'three/webgpu'

/** A soft rectangle of light on the panorama: 1 in its middle, falling off smoothly toward its half extents. */
function panel(u: number, v: number, center: number, halfWidth: number, centerY: number, halfHeight: number) {
  const dx = Math.min(Math.abs(u - center), 1 - Math.abs(u - center)) / halfWidth
  const dy = Math.abs(v - centerY) / halfHeight
  return Math.exp(-(dx ** 4) - dy ** 4)
}
/**
 * Linear radiance of a dim gallery as a frame on its wall would mirror it, without assets: dark walls and a warm floor, a broad lamp overhead, two narrow strips of light from the sides and a faint cool window.
 *
 * Gilding and polished wood mirror their surroundings. The gallery’s own environment is a dim, olive-tinted gradient that turns gold khaki, and the softly lit studio of the fittings is so bright all round that a whole moulding of gold mirroring it reads as pale cream. This one stays dark between its few lights, so gold keeps its depth and only its curves catch long, bright streaks.
 */
function createFrameStudio() {
  const width = 512
  const height = 256
  const pixels = new Float32Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    // v runs from the zenith at 0 to the nadir at 1.
    const v = (y + 0.5) / height
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width
      const overhead = panel(u, v, 0.5, 0.5, 0.04, 0.07) * 1.4
      const left = panel(u, v, 0.18, 0.025, 0.38, 0.14) * 3
      const right = panel(u, v, 0.7, 0.02, 0.42, 0.1) * 2.2
      const window = panel(u, v, 0.92, 0.06, 0.36, 0.08) * 0.5
      const floor = Math.max(0, v - 0.55) * 0.08
      const walls = 0.015 + 0.02 * Math.sin(Math.PI * v)
      const i = (y * width + x) * 4
      pixels[i] = walls + overhead + left + right * 0.95 + window * 0.8 + floor * 1.2
      pixels[i + 1] = walls + overhead * 0.88 + left * 0.9 + right * 0.93 + window * 0.9 + floor * 0.85
      pixels[i + 2] = walls * 0.9 + overhead * 0.72 + left * 0.8 + right * 0.9 + window + floor * 0.6
      pixels[i + 3] = 1
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType)
  texture.name = 'Procedural dim gallery for frames'
  texture.mapping = EquirectangularReflectionMapping
  texture.wrapS = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
/** the dim gallery every frame material mirrors, shared by all of them, living as long as the page like the shared gold */
const frameStudio = createFrameStudio()

export default frameStudio
