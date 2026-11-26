import {DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RepeatWrapping, RGBAFormat} from 'three/webgpu'

/** how many small lamps hang round the room, spread evenly over the sphere of directions, and how wide each looks, in radians */
const lamps = {
  count: 110,
  radius: 0.022,
}
/** A value from 0 to 1 of its own for every whole number. */
const scatter = (index: number) => {
  const value = Math.sin(index * 12.9898 + 4.1414) * 43_758.5453
  return value - Math.floor(value)
}
/**
 * Linear radiance of a jeweler’s showroom as a cut stone sends it back, without assets: a dark room hung all round with small bright lamps, warm and cool, brightest overhead, and a soft light over the counter. Each facet and each path through the stone catches a lamp or none, so the stone breaks up into the bright and dark facets a cut stone shows, and its sparkle moves as the eye does.
 *
 * Only the stones see it: through them the dim gallery the frames mirror would leave nearly every facet dark.
 */
function createGemStudio() {
  const width = 512
  const height = 256
  const pixels = new Float32Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    // v runs from the zenith at 0 to the nadir at 1.
    const elevation = Math.PI / 2 - (y + 0.5) / height * Math.PI
    const counter = Math.max(0, Math.sin(elevation)) ** 6 * 0.6
    const room = 0.02 + 0.03 * Math.max(0, Math.sin(elevation))
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      pixels[index] = room + counter
      pixels[index + 1] = room * 0.97 + counter * 0.96
      pixels[index + 2] = room * 0.92 + counter * 0.9
      pixels[index + 3] = 1
    }
  }
  // Each lamp a soft dot, splatted round where it lies on the panorama, wider toward the poles where the panorama stretches.
  for (let lamp = 0; lamp < lamps.count; lamp++) {
    const rise = 1 - (lamp + 0.5) / lamps.count * 2
    const elevation = Math.asin(rise)
    const azimuth = lamp * Math.PI * (3 - Math.sqrt(5))
    // Brighter above the counter than below it.
    const power = (2 + 10 * scatter(lamp) ** 2) * (rise > -0.2 ? 1 : 0.35)
    const warmth = scatter(lamp + 0.5)
    const tint = [1, 0.93 + 0.05 * warmth, 0.82 + 0.2 * (1 - warmth)]
    const centerX = azimuth / (Math.PI * 2) % 1 * width
    const centerY = (Math.PI / 2 - elevation) / Math.PI * height
    const spreadY = lamps.radius / Math.PI * height
    const spreadX = spreadY / Math.max(0.15, Math.cos(elevation))
    for (let dy = -Math.ceil(spreadY * 3); dy <= Math.ceil(spreadY * 3); dy++) {
      const py = Math.round(centerY) + dy
      if (py < 0 || py >= height) {
        continue
      }
      for (let dx = -Math.ceil(spreadX * 3); dx <= Math.ceil(spreadX * 3); dx++) {
        const px = ((Math.round(centerX) + dx) % width + width) % width
        const falloff = Math.exp(-(((Math.round(centerX) + dx - centerX) / spreadX) ** 2 + ((py + 0.5 - centerY) / spreadY) ** 2) / 2)
        const index = (py * width + px) * 4
        for (let channel = 0; channel < 3; channel++) {
          pixels[index + channel] += power * falloff * tint[channel]
        }
      }
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, FloatType)
  texture.name = 'Procedural showroom for cut stones'
  texture.mapping = EquirectangularReflectionMapping
  texture.wrapS = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
/** the showroom every cut stone sends back, shared by all of them, living as long as the page */
const gemStudio = createGemStudio()

export default gemStudio
