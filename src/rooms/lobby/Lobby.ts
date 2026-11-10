import type {GroundSurface} from '../base/Room.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {groundFenceY} from '#src/lib/gallery/floors.ts'
import lobby from '#src/lib/gallery/lobby.ts'
import lobbyVault from '#src/lib/gallery/lobbyVault.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import ambienceEmitters from './ambienceEmitters.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import spawns from './spawns.ts'
import walls from './walls.ts'

const size = [lobby.width, lobby.southZ - lobby.northZ] as const
/** the middle of the glazed floor over the Oculus, relative to the room’s middle */
const opening = [lobby.opening.center[0], lobby.opening.center[1] - (lobby.northZ + lobby.southZ) / 2] as const

export default class Lobby extends Room {
  // Up to the crown of the vault.
  override readonly air = floorBox(size, 0, lobbyVault.springY + lobbyVault.outerRadius)
  override readonly description = 'Nothing here is quite as it seems.'
  // Everything over its floor plan from the slab up, the vault and the glazed floor over the Oculus included.
  override readonly fence = new Geofence([{
    ...footprint([this.air]),
    floor: groundFenceY,
  }])
  override readonly height = 5.8
  override readonly id = 'lobby'
  override readonly size = size
  override readonly spawn = spawns['']

  constructor() {
    super({
      title: 'Lobby',
      mood: 'lobby',
      frame: ['lobby-travertine', 'lobby-louis'],
      portraitArea: 30_000,
      cameras,
      spawns,
      ambience: ambienceEmitters,
      lamps,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }

  /** The glazed floor over the Oculus rings like glass. */
  override groundSurface([x, , z]: Vec3): GroundSurface {
    return Math.abs(x - opening[0]) <= lobby.opening.size[0] / 2 + 1e-6 && Math.abs(z - opening[1]) <= lobby.opening.size[1] / 2 + 1e-6 ? 'glass' : 'generic'
  }
}
