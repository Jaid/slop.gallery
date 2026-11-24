import type {Vec3} from 'math'

const size: Vec3 = [0.5, 0.13, 0.004]
const textureWidth = 1024
/** A brass plate engraved with a heading over a byline, like the one naming the Salon’s sculpture on its socket. In meters, its back on the surface it is fixed to. */
const engravedPlate = {
  /** width, height and thickness */
  size,
  /** how far its edges are rounded */
  radius: 0.0012,
  /** how deep its lettering is cut */
  depth: 0.0003,
  /** the raster of its lettering in logical pixels, as many per meter across as up, which the graphics profile’s canvas texture resolution scales */
  texture: [textureWidth, Math.round(textureWidth * size[1] / size[0])] as const,
} as const

export default engravedPlate
