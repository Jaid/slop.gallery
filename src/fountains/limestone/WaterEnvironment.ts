import {DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RepeatWrapping, RGBAFormat} from 'three/webgpu'

/** Direction toward the sun in the reflection, a little above the glazed crown. */
const sun = (() => {
  const elevation = 54 * Math.PI / 180
  const direction = [-0.62, Math.sin(elevation), Math.cos(elevation) * 0.45]
  const length = Math.hypot(...direction)
  return direction.map(value => value / length)
})()
/** Angular radius of the sun’s disc in the reflection. */
const sunRadius = 1.4 * Math.PI / 180

/**
 * What the limestone fountain’s water reflects: a bright sky under a glazed crown like the Lobby’s vault, with the sun in it, as a linear HDR environment.
 *
 * The gallery’s own environment is a dim, olive gradient meant for plaster and stone. Water needs a bright, contrasty sky for its ripples to sparkle, so it borrows this one instead, like the gilt and the satin steel borrow their studios. Everything is procedural.
 *
 * It lives as long as the page, like the shared gold, and is never disposed.
 */
export default class WaterEnvironment extends DataTexture {
  constructor() {
    const width = 1024
    const height = 512
    const pixels = new Float32Array(width * height * 4)
    for (let y = 0; y < height; y++) {
      // v runs from the zenith at the top of the image to the nadir at the bottom.
      const elevation = (0.5 - (y + 0.5) / height) * Math.PI
      const up = Math.sin(elevation)
      const above = Math.max(0, up)
      for (let x = 0; x < width; x++) {
        const azimuth = ((x + 0.5) / width - 0.5) * Math.PI * 2
        // Azure above, a pale haze at the horizon and warm stone below it.
        const sky = 0.5 + 0.9 * above ** 0.55
        const haze = Math.exp(-Math.abs(elevation) * 7)
        const floor = Math.max(0, -up) * 0.3
        const direction = [Math.cos(elevation) * Math.cos(azimuth), up, Math.cos(elevation) * Math.sin(azimuth)]
        const cosine = direction[0] * sun[0] + direction[1] * sun[1] + direction[2] * sun[2]
        const angle = Math.acos(Math.min(1, Math.max(-1, cosine)))
        // A tight disc for the glitter path and a wide aureole around it.
        const disc = angle < sunRadius ? 40 * (1 - (angle / sunRadius) ** 2) : 0
        const aureole = Math.exp(-angle * 5.5) * 4
        // The glazed crown above the fountain is brighter than open sky.
        const crown = Math.exp(-(((elevation - 1.1) / 0.26) ** 2)) * 0.45
        const i = (y * width + x) * 4
        const base = sky + crown + haze * 0.35 + floor
        pixels[i] = base * 0.94 + disc + aureole
        pixels[i + 1] = base * 0.99 + disc * 0.99 + aureole * 0.98
        pixels[i + 2] = base * 1.06 + disc * 0.95 + aureole * 0.94
        pixels[i + 3] = 1
      }
    }
    super(pixels, width, height, RGBAFormat, FloatType)
    this.name = 'Procedural sky reflection'
    this.mapping = EquirectangularReflectionMapping
    this.wrapS = RepeatWrapping
    this.minFilter = LinearFilter
    this.magFilter = LinearFilter
    this.needsUpdate = true
  }
}
