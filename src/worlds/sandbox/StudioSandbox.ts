import type {Artwork} from '#src/lib/gallery/types.ts'

import {lazy} from 'react'

import {environmentSeed} from '#src/lib/gameSeed.ts'
import {studioTuning} from '#src/lib/worldTuning/StudioTuningModule.ts'
import {studioDesign} from '#src/rooms/studio/design.ts'
import {studioSlotRatio} from '#src/rooms/studio/slots.ts'
import Studio from '#src/rooms/studio/Studio.ts'
import artworks from '#src/worlds/gallery/artworks.ts'

import Sandbox from './base/Sandbox.ts'

/** whether the work fits the Studio’s one slot */
const fitsSlot = (artwork: Artwork) => artwork.ratio === studioSlotRatio
const scene = lazy(() => import('#src/rooms/studio/components/StudioRoom/index.tsx'))

/** The Sandbox as `?room=studio` opens it: the Studio instead of the Cell, four bare walls to snap and film things in, which load in a moment, the corner of the north and west ones at the world’s origin, so the floor spreads from there toward +x and +z. */
export default class StudioSandbox extends Sandbox<Studio> {
  /** the catalog’s works that fit the Studio’s one slot, of which the seed hangs one */
  override readonly artworks = artworks.filter(fitsSlot)
  override readonly defaultRoom = 'studio'
  override readonly Scene = scene
  /** everything the Studio is built and lit from */
  override readonly tuning = [studioTuning]

  /**
   * @param seed what rolls the Studio’s design and the openings it names, this game’s by default
   * @param design how large the Studio is, how it is lit, the openings its light falls through and how its works are framed, as the seed rolls it by default
   */
  constructor(seed = environmentSeed, design = studioDesign(seed)) {
    const studio = new Studio(design, seed)
    // The corner lies on the floor, which stays at the world’s height.
    const [x, , z] = studio.corner
    super(studio, [-x, 0, -z])
  }
}
