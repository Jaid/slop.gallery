import type {Vec3} from '../types.ts'
import type {PortalPalette} from './PortalCore.ts'

import {Color, Group} from 'three/webgpu'

import GatheringMotes from './GatheringMotes.ts'
import PrismRipple from './impact/PrismRipple.ts'
import OrbitTrail from './OrbitTrail.ts'
import PortalCore from './PortalCore.ts'
import PortalSparks from './PortalSparks.ts'
import RealityWarp from './RealityWarp.ts'
import Tether from './Tether.ts'

/** the portal’s own colors: a deep indigo heart, an electric blue swirl and a golden rim */
export const portalPalette = {
  core: '#14062e',
  swirl: '#3fc4ff',
  rim: '#ffd98a',
}
/** what a fizzling portal dies down to */
export const emberPalette = {
  core: '#140300',
  swirl: '#ff5418',
  rim: '#ffab66',
}

/** The palette of a portal tinted in `color`, like an orb’s glow: a darker heart, a brighter swirl and a rim close to white; the portal’s own without one. */
export function paletteOf(color?: string): PortalPalette {
  if (!color) {
    return {
      core: new Color(portalPalette.core),
      swirl: new Color(portalPalette.swirl),
      rim: new Color(portalPalette.rim),
    }
  }
  const tint = new Color(color)
  return {
    core: tint.clone().multiplyScalar(0.1),
    swirl: tint.clone().offsetHSL(0, 0.1, 0.12),
    rim: tint.clone().lerp(new Color('#ffffff'), 0.62),
  }
}

/**
 * Everything a fusion’s portal draws: its glowing disc and its sparks, and the parts only the intro shows, the motes and a tether for each of the two things orbiting it, or the intro and the climax, the warp and a trail of fire for each. All but the tethers and the trails stand at the portal’s middle; those lay themselves out in the world.
 * At radius 0 and without energy, nothing shows, but every part still draws, which lets their pipelines compile behind the loading screen.
 */
export default class PortalVisuals {
  readonly core = new PortalCore
  readonly motes = new GatheringMotes
  /** the ripple the strike that opened it sends out from where it struck the work */
  readonly ripple = new PrismRipple
  readonly root = new Group
  readonly sparks = new PortalSparks
  readonly tethers = [new Tether(5.1), new Tether(17.3)]
  readonly trails = [new OrbitTrail(0), new OrbitTrail(9.4)]
  readonly warp = new RealityWarp
  private readonly middle = new Group

  constructor() {
    this.root.name = 'fusion'
    this.middle.add(this.warp, this.core, this.sparks, this.motes)
    this.root.add(this.middle, ...this.trails, ...this.tethers, this.ripple)
  }

  dispose() {
    this.core.dispose()
    this.sparks.dispose()
    this.warp.dispose()
    this.motes.dispose()
    this.ripple.dispose()
    for (const part of [...this.tethers, ...this.trails]) {
      part.dispose()
    }
  }

  /** Colors every part. */
  paint({core, rim, swirl}: PortalPalette) {
    this.core.uniforms.core.value.copy(core)
    this.ripple.paint({
      core,
      rim,
      swirl,
    })
    for (const {uniforms} of [this.core, this.sparks, this.motes, ...this.tethers, ...this.trails]) {
      uniforms.rim.value.copy(rim)
      uniforms.swirl.value.copy(swirl)
    }
  }

  /** Moves the disc and the sparks to the portal’s middle. */
  place(center: Vec3) {
    this.middle.position.fromArray(center)
  }
}
