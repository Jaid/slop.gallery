import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {bastionOrigin, bastionTransition} from '#src/lib/gallery/bastion.ts'
import {climbApex, climbHairpin} from '#src/lib/gallery/climb.ts'

import Room from '../base/Room.ts'
import cameras from './cameras.ts'
import fences, {bastionAir, bastionFence} from './fences.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import spawns from './spawns.ts'
import upperMap from './upperMap.svg?raw'
import walls from './walls.ts'

/**
 * The connected castle-stone passages from both Oculus bridges, around its apse to the Lodge and up the western hairpin to the Forge, and the cistern behind the Forge’s vestibule, which the alchemy machine shoots its orbs into.
 * Laid out around the middle of its curve, at the height of its floor there.
 */
export default class Bastion extends Room {
  override readonly air = bastionAir
  override readonly description = 'Cold stone. Long shadows. Light through iron bars.'
  // Height-bounded because the west wing passes under Forge and above Lodge, and the cistern over the Lodge and the curve. It also takes precedence over the Oculus’ apse box.
  override readonly fence = bastionFence
  override readonly id = 'bastion'
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'The Bastion',
      mood: 'bastion',
      frame: ['strapwork', 'oak'],
      cameras,
      fences,
      spawns,
      lamps,
      skybox: 'sky',
      // The passage lies deep under the ground floor, out of the sun’s reach.
      sunlit: false,
      volumetricSun: 0,
      walls,
      map,
      // From the apex of the western hairpin on, the climb shows on the upper floor with the Forge it leads to: from where its floor rises over the floor in the middle of the apex, where its paving falls lowest.
      upperMap: {
        from: climbHairpin.floorAt(...climbApex.point)! - bastionOrigin[1],
        map: upperMap,
      },
    })
  }

  /** The flagstones grind underfoot, the planks of the timber end by the Lodge sound hollow. */
  override groundSurface([x, , z]: Vec3): GroundSurface {
    const {center, size} = bastionTransition.floor
    const onPlanks = Math.abs(x + bastionOrigin[0] - center[0]) <= size[0] / 2 + 1e-6 && Math.abs(z + bastionOrigin[2] - center[1]) <= size[1] / 2 + 1e-6
    return onPlanks ? 'hollow' : 'stone'
  }
}
