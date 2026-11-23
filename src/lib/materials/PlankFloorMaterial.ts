import type {FloorReflection} from './FloorMaterial.ts'
import type {PlankLayout} from './planks.ts'

import {float, materialRoughness, mx_noise_float, normalWorldGeometry, positionWorld, vec3} from 'three/tsl'

import {visibleDetail, worldNormalToView} from './filters.ts'
import FloorMaterial from './FloorMaterial.ts'
import {plankBoards} from './planks.ts'

/** How the finish on the boards shades them and how much of the room it mirrors in heavy mode. */
export type PlankFinish = {
  /** the environment’s share of the lighting, by default all of it with the mirror and none without */
  envMapIntensity?: number
  /** the mirror in heavy mode, which the joints and every face but those looking up leave out */
  reflection: Omit<FloorReflection, 'mask'>
  /** the boards’ roughness with the mirror and without it, in fast mode */
  roughness: {
    matte: number
    mirrored: number
  }
}

/** Long, warm oak boards under a satin varnish, for the Sienna. */
export const siennaFloorPlanks: PlankLayout = {
  axis: 'x',
  width: 0.19,
  length: [1.5, 2.8],
  figure: {
    meander: 2.5,
    rings: 150,
  },
  knots: 0.08,
  bevel: 0.003,
  seam: 0.0016,
  seed: 23,
  colors: {
    dark: '#351b0c',
    light: '#5f3a1e',
    ring: '#271309',
    seam: '#160c06',
  },
}

/** The satin varnish fills the grain, so the reflection is soft but continuous across a board; without it, the boards turn rougher. */
export const satinVarnish: PlankFinish = {
  roughness: {
    mirrored: 0.52,
    matte: 0.66,
  },
  reflection: {
    strength: 0.025,
    grazingStrength: 0.25,
    loss: 3.2,
  },
}

/**
 * Finished boards (see {@link plankBoards}) that mirror the room in heavy mode, by default the Sienna’s under a satin varnish.
 *
 * The mirror is continuous across a board and only breaks at the joints, which stay matte. A faint, broad waviness in the finish bends the mirrored lamps the way a hand-laid floor does.
 */
export default class PlankFloorMaterial extends FloorMaterial {
  constructor(readonly layout: PlankLayout = siennaFloorPlanks, reflections = true, readonly finish: PlankFinish = satinVarnish) {
    if (!(layout.width > 0) || !(layout.length[0] > 0) || !(layout.length[1] >= layout.length[0])) {
      throw new RangeError('Floor boards need a positive width and a shortest length no longer than the longest.')
    }
    const roughness = reflections ? finish.roughness.mirrored : finish.roughness.matte
    // around the material’s own roughness, so setting it anew changes the boards without rebuilding them
    const boards = plankBoards(layout, materialRoughness)
    super(null, {
      color: '#ffffff',
      envMapIntensity: finish.envMapIntensity,
      roughness,
      reflection: reflections ? {
        ...finish.reflection,
        mask: boards.joint.oneMinus().mul(normalWorldGeometry.y.step(0.5)),
      } : undefined,
    })
    this.colorNode = boards.color
    this.roughnessNode = boards.roughness
    const footprint = positionWorld.x.fwidth().max(positionWorld.z.fwidth())
    const ripple = vec3(mx_noise_float(vec3(positionWorld.x.mul(2.3), positionWorld.z.mul(2.3), float(layout.seed))), 0, mx_noise_float(vec3(positionWorld.x.mul(2.3), positionWorld.z.mul(2.3), float(layout.seed + 7)))).mul(0.012).mul(visibleDetail(footprint, 0.04))
    this.normalNode = worldNormalToView(reflections ? boards.normal.add(ripple).normalize() : boards.normal)
  }
}
