import type {Vec3} from '../gallery/types.ts'
import type {PlacementObstruction} from './base/PlacementSpace.ts'
import type {Wall} from './wallGeometry.ts'

import {forgeWindow, lobbyWindowGlassDistance, salonWindow} from '../gallery/lobbyWindows.ts'
import {lodgeWindowGlassDistance} from '../gallery/lodge.ts'
import {PlacementSpace} from './base/PlacementSpace.ts'
import {placementIssues} from './wallGeometry.ts'

/**
 * The museum’s rooms, stairs and passages.
 *
 * The gallery world constructs it with its walls, floors and volume, which it cannot import itself without a cycle, and with which of the walls are there, see {@link GalleryPlacementSpace.walls}.
 */
export class GalleryPlacementSpace extends PlacementSpace {
  private presentWalls: ReadonlyArray<Wall> | undefined = undefined

  /**
   * @param allWalls every wall of the gallery
   * @param presence which walls are there and where lost works return to, asked once the space is first used: the part of the gallery this page mounts and a point in it, by default every wall and the Lobby
   */
  constructor(private readonly allWalls: ReadonlyArray<Wall>, private readonly navigation: {
    contains: (position: Vec3) => boolean
    floorHeight: (position: Vec3) => number
  }, private readonly presence: {
    covers: (wall: Wall) => boolean
    recovery: () => Vec3
  } = {
    covers: () => true,
    recovery: () => [0, 1, 4],
  }) {
    super()
  }

  /** where works that fell out of the world reappear, which `presence` picks */
  get recoveryPosition(): Vec3 {
    return this.presence.recovery()
  }

  /** the walls that are there, which works hang on and rays stop at: those of the rooms this page mounts */
  get walls() {
    if (!this.presentWalls) {
      const present = this.allWalls.filter(wall => this.presence.covers(wall))
      this.presentWalls = present.length === this.allWalls.length ? this.allWalls : present
    }
    return this.presentWalls
  }

  contains(position: Vec3) {
    return this.navigation.contains(position)
  }

  floorHeight(position: Vec3) {
    return this.navigation.floorHeight(position)
  }

  /** The glass of the Lodge window and of the windows between the Lobby and the Salon and the Forge stops the aim before the walls behind it. */
  protected override obstruction(origin: Vec3, direction: Vec3): PlacementObstruction | null {
    const panes = [
      {
        distance: lodgeWindowGlassDistance(origin, direction),
        wallId: 'lodge-west',
      },
      {
        distance: lobbyWindowGlassDistance(salonWindow, origin, direction),
        wallId: direction[0] < 0 ? 'salon-west' : 'lobby-extension_east',
      },
      {
        distance: lobbyWindowGlassDistance(forgeWindow, origin, direction),
        wallId: direction[0] < 0 ? 'lobby-extension_west' : 'forge-east',
      },
    ]
    const pane = panes.filter(candidate => candidate.distance !== undefined).toSorted((a, b) => a.distance! - b.distance!).at(0)
    if (!pane) {
      return null
    }
    const distance = pane.distance!
    return {
      distance,
      placement: {
        fits: false,
        inReach: distance * Math.hypot(...direction) <= this.reach,
        position: [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance, origin[2] + direction[2] * distance],
        rotation: direction[0] < 0 ? Math.PI / 2 : -Math.PI / 2,
        wallId: pane.wallId,
        valid: false,
        reason: placementIssues.window,
      },
    }
  }
}
