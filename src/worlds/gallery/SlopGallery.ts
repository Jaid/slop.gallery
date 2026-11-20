import type {Vec3} from '#src/lib/gallery/types.ts'
import type PlacedRoom from '../base/PlacedRoom.ts'
import type {PlacedLamp} from '../base/PlacedRoom.ts'
import type {RoomPlacement} from '../base/World.ts'

import {lazy} from 'react'

import IntroOrbit from '#src/lib/camera/IntroOrbit.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import {lobbyFountain, lobbyFountainSpot} from '#src/lib/gallery/lobbyFountain.ts'
import showcasedKnots from '#src/lib/gallery/showcasedKnots.ts'
import {GalleryPlacementSpace} from '#src/lib/placement/GalleryPlacementSpace.ts'
import Antechamber from '#src/rooms/antechamber/Antechamber.ts'
import Banquet from '#src/rooms/banquet/Banquet.ts'
import Bastion from '#src/rooms/bastion/Bastion.ts'
import Corridor from '#src/rooms/corridor/Corridor.ts'
import Exhibition from '#src/rooms/exhibition/Exhibition.ts'
import Forge from '#src/rooms/forge/Forge.ts'
import Lobby from '#src/rooms/lobby/Lobby.ts'
import Lodge from '#src/rooms/lodge/Lodge.ts'
import Moonfall from '#src/rooms/moonfall/Moonfall.ts'
import Oculus from '#src/rooms/oculus/Oculus.ts'
import Salon from '#src/rooms/salon/Salon.ts'
import Sienna from '#src/rooms/sienna/Sienna.ts'
import Vesper from '#src/rooms/vesper/Vesper.ts'

import World from '../base/World.ts'
import {worlds} from '../index.ts'
import {audibleFences, enabledRooms, litFences} from './activations.ts'
import artworks from './artworks.ts'
import fences from './fences.ts'
import GalleryNavigation from './navigation.ts'
import sky from './sky.ts'

/** a room of the gallery */
export type GalleryRoom = Antechamber | Banquet | Bastion | Corridor | Exhibition | Forge | Lobby | Lodge | Moonfall | Oculus | Salon | Sienna | Vesper
export type GalleryRoomId = GalleryRoom['id']

/**
 * Every room at the origin the gallery’s layout gives it, in the order their fences are checked: the ground floor first, then the lower rooms, each passage after the rooms its fence meets.
 * The Bastion comes before both the Oculus, whose fence takes in the box around its apse, and the Lodge, whose fence reaches through its roof into the Bastion’s upper run.
 */
const placements: ReadonlyArray<RoomPlacement<GalleryRoom>> = [
  new Lobby,
  new Vesper,
  new Banquet,
  new Antechamber,
  new Sienna,
  new Salon,
  new Forge,
  new Moonfall,
  new Bastion,
  new Lodge,
  new Corridor,
  new Oculus,
  new Exhibition,
].map(room => [room, roomOrigins[room.id]])
/** where works that fell out of the gallery reappear: a meter over the Lobby’s floor, south of its fountain */
const lobbyRecovery: Vec3 = [0, 1, 4]
const minimap = lazy(() => import('#component/GalleryMinimap'))
const scene = lazy(() => import('#component/GalleryScene'))

/** The museum: its upper floor of galleries around the Lobby, and the lower floor around Moonfall and the Oculus below. */
export default class SlopGallery extends World<GalleryRoom> {
  override readonly artworks = artworks
  override readonly defaultRoom = 'lobby'
  override readonly id = 'gallery'
  /** Round the Lobby’s fountain, past its benches and looking down on its basin, starting from the south-east between two benches, the fountain in focus. Eyes 4 m up drop the entering player 2.4 m onto the floor. */
  override readonly introOrbit = new IntroOrbit({
    target: [lobbyFountainSpot[0], lobbyFountainSpot[1] + 0.9, lobbyFountainSpot[2]],
    radius: 6.2,
    elevation: 3.1,
    period: 60,
    start: Math.PI / 4,
    subject: lobbyFountain.radius,
  })
  override readonly Minimap = minimap
  override readonly narratesIntroduction = true
  override readonly placement: GalleryPlacementSpace
  override readonly Scene = scene

  private readonly navigation: GalleryNavigation

  constructor() {
    super(worlds.gallery, placements, fences)
    this.navigation = new GalleryNavigation(this.rooms)
    // Walls of rooms out of reach aren’t there to hang anything on or to stop a ray, and lost works return to the Lobby only while it is there.
    this.placement = new GalleryPlacementSpace(this.walls, this.navigation, {
      covers: wall => this.reach.covers(wall.room),
      recovery: () => {
        if (this.reach.covers(this.defaultRoom)) {
          return lobbyRecovery
        }
        const [x, y, z] = this.spawnInReach.position
        return [x, y + 1, z]
      },
    })
  }

  /** An ambient sound is only audible while the player is in its own room or in a fence it carries into. */
  override ambienceFences(room: string, ambience: string) {
    return audibleFences(room as GalleryRoomId, ambience)
  }

  override contains(position: Vec3) {
    return this.navigation.contains(position)
  }

  /** The Knots the gallery showcases while their rooms are mounted. */
  override dumpKnots() {
    return showcasedKnots.values().toArray()
  }

  override floorHeight(position: Vec3) {
    return this.navigation.floorHeight(position)
  }

  /** A lamp only shines while the player is in its own room or in a fence that keeps it on, because it reaches in or can be seen from there. */
  override lampFences(lamp: PlacedLamp) {
    return litFences(lamp.room as GalleryRoomId, lamp.id)
  }

  /** A room’s neighbors are the rooms the fences a player in it may be in keep enabled, see `activations.ts`: the rooms a player can see into from anywhere in it. */
  override neighbors(room: string): ReadonlyArray<GalleryRoomId> {
    return enabledRooms(this.fencesIn(room))
  }

  override roomTagline(room: PlacedRoom<GalleryRoom>) {
    return room.floorY < 0 ? 'lower floor room' : 'upper floor room'
  }

  /** `sky` is the procedural sky in every weather: the lighting preset only repaints its uniforms, so switching presets never recompiles it. */
  override skybox(id: string) {
    return id === 'sky' ? sky : null
  }

  /** How far a ray from the origin travels until it meets a wall, a little farther than the wall itself. */
  override wallDistance(origin: Vec3, direction: Vec3) {
    const hit = this.placement.findPlacement(origin, direction, 0, 0, [])
    return hit ? Math.hypot(...hit.position.map((value, index) => value - origin[index]) as Vec3) + 0.3 : Infinity
  }
}
