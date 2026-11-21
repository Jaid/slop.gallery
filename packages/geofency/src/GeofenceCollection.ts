import type {Box} from './box/index.ts'
import type {Fence, Position} from './types.ts'

import Geofence from './Geofence.ts'
import RelationalGeofence from './RelationalGeofence.ts'

/** the fences of a collection in its order, with the positions in that order of the fences each relational one relates to, built once per change of the collection */
type Plan<Id> = {
  fences: ReadonlyArray<Fence>
  ids: ReadonlyArray<Id>
  /** the position of each fence by its id */
  positions: ReadonlyMap<Id, number>
  /** per fence, the positions of the fences it relates to, undefined for a plain one */
  relations: ReadonlyArray<ReadonlyArray<number> | undefined>
}

/** what a probe knows about a fence besides nothing yet, 0: that it holds the position, or that it does not */
const known = {
  holds: 1,
  holdsNot: 2,
} as const

/**
 * Fences by id, checked in insertion order.
 * A {@link RelationalGeofence} among them holds wherever its own boxes do and wherever any fence of the collection it relates to holds, through theirs, so it may relate to fences that come after it, like a room to its parts. Every query asks each fence’s own boxes at most once, however many fences relate to it.
 */
export default class GeofenceCollection<Id = string, Value extends Fence = Fence> extends Map<Id, Value> {
  /** the plan of the fences as they are now, undefined once they changed */
  private planned: Plan<Id> | undefined = undefined

  /** the fences as they are now, planned anew after any change, which throws for a relation to a fence the collection lacks */
  private get plan() {
    if (!this.planned) {
      const ids = this.keys().toArray()
      const positions = new Map(ids.map((id, position) => [id, position]))
      this.planned = {
        ids,
        positions,
        fences: this.values().toArray(),
        relations: ids.map(id => (this.get(id) instanceof RelationalGeofence ? this.relationsOf(id).map(related => positions.get(related)!) : undefined)),
      }
    }
    return this.planned
  }

  override clear() {
    this.planned = undefined
    super.clear()
  }

  /** Whether the fence with the id holds the position, by itself or, for a relational one, by any fence it relates to; false for an id the collection lacks. */
  contains(id: Id, position: Position) {
    const index = this.plan.positions.get(id)
    return index !== undefined && this.probe(position)(index)
  }

  override delete(id: Id) {
    this.planned = undefined
    return super.delete(id)
  }

  /** The id of the first fence that holds the position, or null if none does. */
  getMatch(position: Position) {
    const {ids} = this.plan
    const holds = this.probe(position)
    for (const [index, id] of ids.entries()) {
      if (holds(index)) {
        return id
      }
    }
    return null
  }

  /** The ids of every fence that holds the position, in insertion order. */
  getMatches(position: Position) {
    const {ids} = this.plan
    const holds = this.probe(position)
    const matches: Array<Id> = []
    for (const [index, id] of ids.entries()) {
      if (holds(index)) {
        matches.push(id)
      }
    }
    return matches
  }

  /** The ids of the fences the fence with the id relates to, in its order: none for a fence that is no {@link RelationalGeofence} or an id the collection lacks. Throws for a relation to a fence the collection lacks. */
  relationsOf(id: Id): Array<Id> {
    const fence = this.get(id)
    if (!(fence instanceof RelationalGeofence)) {
      return []
    }
    return fence.relations.values().map(relation => {
      if (!this.has(relation as Id)) {
        throw new RangeError(`The fence “${String(id)}” relates to “${relation}”, which the collection lacks.`)
      }
      return relation as Id
    }).toArray()
  }

  /**
   * The space the fence with the id takes in, as a fence of boxes alone: the fence as it is, unless it is a {@link RelationalGeofence}, then a new geofence of its own boxes and those of every fence it relates to, through theirs, each box once; undefined for an id the collection lacks.
   * Throws for a relational fence that takes in a fence which is no geofence, as that has no boxes to take.
   */
  resolve(id: Id): Geofence | Value | undefined {
    const fence = this.get(id)
    if (!(fence instanceof RelationalGeofence)) {
      return fence
    }
    const queue = [id]
    const seen = new Set(queue)
    const boxes = new Set<Box>
    while (queue.length) {
      const current = queue.shift()!
      const taken = this.get(current)
      if (!(taken instanceof Geofence)) {
        throw new TypeError(`The fence “${String(id)}” takes in “${String(current)}”, which is no geofence.`)
      }
      for (const box of taken.boxes) {
        boxes.add(box)
      }
      for (const related of this.relationsOf(current)) {
        if (seen.has(related)) {
          continue
        }
        seen.add(related)
        queue.push(related)
      }
    }
    return new Geofence([...boxes])
  }

  override set(id: Id, fence: Value) {
    this.planned = undefined
    return super.set(id, fence)
  }

  /**
   * Whether the fence at a position in the plan holds the position, by itself or by any fence it relates to, through theirs, breadth first, for one position: each fence’s own boxes are asked at most once, however many relational fences relate to it.
   */
  private probe(position: Position) {
    const {fences, relations} = this.plan
    /** whether each fence itself holds the position, by its own boxes for a relational one */
    const own = new Uint8Array(fences.length)
    /** whether each fence or any fence it relates to, through theirs, holds the position */
    const held = new Uint8Array(fences.length)
    const ownHolds = (index: number) => {
      own[index] ||= fences[index].contains(position) ? known.holds : known.holdsNot
      return own[index] === known.holds
    }
    return (index: number) => {
      if (held[index]) {
        return held[index] === known.holds
      }
      // A plain fence holds what it holds, which needs no walk through relations.
      if (!relations[index]) {
        held[index] = ownHolds(index) ? known.holds : known.holdsNot
        return held[index] === known.holds
      }
      const queue = [index]
      const seen = new Set(queue)
      while (queue.length) {
        const current = queue.shift()!
        if (held[current] === known.holds || !held[current] && ownHolds(current)) {
          held[index] = known.holds
          return true
        }
        // Known to hold nothing, all it relates to included, which spares going through its relations again.
        if (held[current] === known.holdsNot) {
          continue
        }
        for (const related of relations[current] ?? []) {
          if (seen.has(related)) {
            continue
          }
          seen.add(related)
          queue.push(related)
        }
      }
      // None of them holds it, so neither does any of them by what it relates to, which all lies among them.
      for (const current of seen) {
        held[current] = known.holdsNot
      }
      return false
    }
  }
}
