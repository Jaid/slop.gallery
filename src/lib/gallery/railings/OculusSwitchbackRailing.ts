import type {RailingAnchor} from './RailingPath.ts'

import {oculusLowerRamps, oculusRampLandings, rampLandingCorner} from '../lowerGallery.ts'
import RailingPath from './RailingPath.ts'

/** Guards the lower flight’s open edge and the outside of its turning landing, leaving the center divider open at the turn. */
export default class OculusSwitchbackRailing extends RailingPath {
  constructor(side: 'east' | 'west') {
    const flight = oculusLowerRamps.find(ramp => ramp.side === side)!
    const landing = oculusRampLandings.find(value => value.side === side)!
    const sign = side === 'west' ? -1 : 1
    const inset = 0.12
    const x = flight.x - sign * (flight.width / 2 - inset)
    const topY = flight.floorY + flight.rise
    const southZ = landing.position[2] + landing.size[2] / 2 - inset
    const wallX = landing.position[0] + sign * (landing.size[0] / 2 - 0.3)
    const radius = landing.cornerRadius - inset
    const corner = rampLandingCorner(landing)
    // On the landing, the rail sits at the half height of the tower’s fence. The sloped rail climbs until it reaches that level, bending into it along a parabola that is tangent to both.
    const landingHeight = flight.railHeight / 2
    const slope = flight.rise / flight.run
    const levelY = topY + landingHeight
    const meet = (levelY - flight.floorY - flight.railHeight) / slope
    const blend = Math.min(0.8, meet, flight.run - meet)
    const anchors: Array<RailingAnchor> = []
    const rail = (distance: number, railY: number) => {
      const groundY = flight.floorY + slope * distance
      anchors.push({
        ground: [x, groundY, flight.startZ + distance],
        height: railY - groundY,
      })
    }
    rail(0, flight.floorY + flight.railHeight)
    for (let i = 0; i <= 12; i++) {
      const offset = i / 12 * blend * 2
      const distance = meet - blend + offset
      rail(distance, flight.floorY + flight.railHeight + slope * distance - slope * offset ** 2 / (4 * blend))
    }
    rail(flight.run, levelY)
    const top = (ground: RailingAnchor['ground']) => anchors.push({
      ground,
      height: landingHeight,
    })
    top([x, topY, southZ - radius])
    // Follow the landing’s rounded corner at the same inset.
    for (let i = 1; i <= 16; i++) {
      const angle = i / 16 * Math.PI / 2
      top([corner.x + corner.sign * radius * Math.cos(angle), topY, corner.z + radius * Math.sin(angle)])
    }
    top([wallX, topY, southZ])
    super(anchors)
    // The end stops short of the wall and overhangs its last post.
    this.posts.pop()
  }
}
