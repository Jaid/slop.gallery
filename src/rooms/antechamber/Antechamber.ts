import type {FloorSize, RoomSpawn} from '../base/Room.ts'

import {Geofence} from 'geofency'
import {Box3, Vector3} from 'three/webgpu'

import {antechamber, antechamberAnnexes, antechamberFenceFloor, upperGalleryStair} from '#src/lib/gallery/antechamber.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import cameras from './cameras.ts'
import lamps from './lamps.ts'
import map from './map.svg?raw'
import slots from './slots.ts'
import walls from './walls.ts'

const size: FloorSize = antechamber.size
const [, originZ] = antechamber.center
const air = [antechamber, ...antechamberAnnexes].map(bay => floorBox(bay.size, bay.floorY, bay.ceiling - bay.floorY, [bay.center[0], bay.center[1] - originZ]))
const stairAir = upperGalleryStair.chunks(0).map(({min, max}) => new Box3(new Vector3(min[0], min[1], min[2] - originZ), new Vector3(max[0], max[1], max[2] - originZ)))

/** A stained-glass rotunda between the descent to Moonfall and the new gallery stair. */
export default class Antechamber extends Room {
  override readonly air = [...air, ...stairAir]
  override readonly description = 'A pause between the peculiar and the profound.'
  override readonly fence = new Geofence([
    ...[antechamber, ...antechamberAnnexes].map(bay => ({
      x: bay.west,
      x2: bay.east,
      z: bay.north - originZ,
      z2: bay.south - originZ,
      y: antechamberFenceFloor(bay.floorY),
      y2: bay.ceiling + 0.2,
    })),
    ...stairAir.map(box => ({
      ...footprint([box]),
      y: antechamberFenceFloor(0),
      y2: box.max.y + 0.2,
    })),
  ])
  // Taller than the other upper rooms, a meter short of a cube.
  override readonly height = 7
  override readonly id = 'antechamber'
  override readonly size = size
  // Just north of the middle, looking toward the south wall.
  override readonly spawn = {
    position: [0, 0.04, -1.1],
    yaw: -Math.PI,
    pitch: 0,
  } satisfies RoomSpawn

  constructor() {
    super({
      title: 'The Antechamber',
      mood: 'antechamber',
      frame: ['kumiko'],
      cameras,
      lamps,
      skybox: 'sky',
      slots,
      walls,
      map,
    })
  }
}
