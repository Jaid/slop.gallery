import type {Placement, Portrait, Vec3} from '../../gallery/types.ts'
import type {PlacementOptions, Wall} from '../wallGeometry.ts'

import {aiAvailable} from '../../ai/settings.ts'
import {placardSide} from '../../gallery/portraitLabel.ts'
import {insideOpening, placementIssue, placementIssues, placementReach, wallCoordinates, wallPosition, wallRayDistance} from '../wallGeometry.ts'

/** something in front of the walls that a placement ray stops at, like a pane of glass */
export type PlacementObstruction = {
  /** in multiples of the ray direction */
  distance: number
  /** the placement there, whose placard stays where the work’s own goes */
  placement: Omit<Placement, 'placard'>
}

/**
 * Where a world lets artworks hang and land: its walls, its floor and its volume.
 *
 * Every world supplies one as its `placement`. Dragging, placing, throwing, importing and the artwork bodies all ask it instead of a particular world’s architecture.
 */
export abstract class PlacementSpace {
  /** whether works without a placard may still get one, which only a page with `?ai=false` rules out; where they can’t, they hang as if they never had one, keeping no room for it */
  readonly placardsPossible = aiAvailable
  readonly reach = placementReach
  /** where artworks reappear after falling out of the world */
  abstract readonly recoveryPosition: Vec3
  /** every wall that a placement ray can hit, sticky or not */
  abstract readonly walls: ReadonlyArray<Wall>
  private wallIndex: Map<string, Wall> | undefined

  /** whether an artwork, hung or loose, may be at this position */
  abstract contains(position: Vec3): boolean
  /**
   * The wall an artwork aimed along this ray would hang on, with whether and why not it fits there, or `null` if the ray hits no wall.
   *
   * The placard stays on the side given by `placard` unless only the placard blocks the spot: then it moves to the other side of the frame, and the placement says so.
   */
  findPlacement(origin: Vec3, direction: Vec3, width: number, height: number, portraits: ReadonlyArray<Portrait>, options: PlacementOptions = {}): Placement | null {
    const {placard = 'below'} = options
    const obstruction = this.obstruction(origin, direction)
    let nearest = obstruction?.distance ?? Infinity
    let result: Placement | null = obstruction ? {
      ...obstruction.placement,
      placard,
    } : null
    const length = Math.hypot(...direction)
    for (const candidateWall of this.walls) {
      const distance = wallRayDistance(candidateWall, origin, direction)
      if (distance < 0 || distance >= nearest) {
        continue
      }
      const point: Vec3 = [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance, origin[2] + direction[2] * distance]
      const u = wallCoordinates(candidateWall, point)
      const base = candidateWall.center[1] + u * (candidateWall.slope ?? 0)
      if (Math.abs(u) > candidateWall.width / 2 || point[1] < base || point[1] > base + candidateWall.height) {
        continue
      }
      if (candidateWall.holes?.some(hole => !hole.glassThickness && insideOpening(hole, u, point[1] - candidateWall.center[1]))) {
        continue
      }
      nearest = distance
      const position = wallPosition(candidateWall, u, point[1])
      const inReach = distance * length <= this.reach
      let side = placard
      // The spot is judged even out of reach, so its preview tells whether walking up to it would do.
      let issue: Placement['reason'] = this.placementIssue(candidateWall, position, width, height, portraits, {
        ...options,
        placard: side,
      })
      const otherSide = placard === 'above' ? 'below' : 'above'
      if (issue && placard !== 'none' && !this.placementIssue(candidateWall, position, width, height, portraits, {
        ...options,
        placard: otherSide,
      })) {
        side = otherSide
        issue = ''
      }
      const reason: Placement['reason'] = inReach ? issue : placementIssues.reach
      result = {
        fits: !issue,
        inReach,
        placard: side,
        position,
        rotation: candidateWall.rotation - (candidateWall.curveRadius ? u / candidateWall.curveRadius : 0),
        wallId: candidateWall.id,
        valid: !reason,
        reason,
      }
    }
    return result
  }

  /** height of the walkable floor under a position */
  abstract floorHeight(position: Vec3): number

  /** Something in front of the walls that stops a placement ray first. */
  protected obstruction(_origin: Vec3, _direction: Vec3): PlacementObstruction | null {
    return null
  }

  /** Where the placard of a work takes up room on this world’s walls, see {@link placardsPossible}. */
  placardOf(work: Parameters<typeof placardSide>[0]) {
    return placardSide(work, this.placardsPossible)
  }

  /** Why an artwork of this size cannot hang centered at `position` on a wall, or an empty string if it can; hung works keep room for placards they may still get as {@link placardsPossible} says unless told otherwise. */
  placementIssue(targetWall: Wall, position: Vec3, width: number, height: number, portraits: ReadonlyArray<Portrait>, options: PlacementOptions = {}) {
    return placementIssue(targetWall, position, width, height, portraits, {
      placardsPossible: this.placardsPossible,
      ...options,
    })
  }

  wall(id: string) {
    this.wallIndex ??= new Map(this.walls.map(candidate => [candidate.id, candidate]))
    return this.wallIndex.get(id)
  }
}
