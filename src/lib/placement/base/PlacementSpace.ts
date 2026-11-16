import type {Placement, Portrait, Vec3} from '../../gallery/types.ts'
import type {Wall} from '../wallGeometry.ts'

import {insideOpening, placementIssue, placementIssues, placementReach, wallCoordinates, wallPosition, wallRayDistance} from '../wallGeometry.ts'

/** something in front of the walls that a placement ray stops at, like a pane of glass */
export type PlacementObstruction = {
  /** in multiples of the ray direction */
  distance: number
  placement: Placement
}

/**
 * Where a world lets artworks hang and land: its walls, its floor and its volume.
 *
 * Every world supplies one as its `placement`. Dragging, placing, throwing, importing and the artwork bodies all ask it instead of a particular world’s architecture.
 */
export abstract class PlacementSpace {
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
   * The placard stays on the side given by `labelAbove` unless only the placard blocks the spot: then it moves to the other side of the frame, and the placement says so.
   */
  findPlacement(origin: Vec3, direction: Vec3, width: number, height: number, portraits: ReadonlyArray<Portrait>, ignoreId = '', labelAbove = false): Placement | null {
    const obstruction = this.obstruction(origin, direction)
    let nearest = obstruction?.distance ?? Infinity
    let result = obstruction?.placement ?? null
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
      let above = labelAbove
      // The spot is judged even out of reach, so its preview tells whether walking up to it would do.
      let issue: Placement['reason'] = this.placementIssue(candidateWall, position, width, height, portraits, ignoreId, above)
      if (issue && !this.placementIssue(candidateWall, position, width, height, portraits, ignoreId, !above)) {
        above = !above
        issue = ''
      }
      const reason: Placement['reason'] = inReach ? issue : placementIssues.reach
      result = {
        fits: !issue,
        inReach,
        labelAbove: above,
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

  /** Why an artwork of this size cannot hang centered at `position` on a wall, or an empty string if it can. */
  placementIssue(targetWall: Wall, position: Vec3, width: number, height: number, portraits: ReadonlyArray<Portrait>, ignoreId = '', labelAbove = false) {
    return placementIssue(targetWall, position, width, height, portraits, ignoreId, labelAbove)
  }

  wall(id: string) {
    this.wallIndex ??= new Map(this.walls.map(candidate => [candidate.id, candidate]))
    return this.wallIndex.get(id)
  }
}
