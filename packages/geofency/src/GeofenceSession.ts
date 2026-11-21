import type GeofenceCollection from './GeofenceCollection.ts'
import type {Fence, Position} from './types.ts'

import EventEmitter from 'eventemitter3'

export type GeofenceSessionEvents<Id> = {
  /** the first match changed; null only with {@link GeofenceSessionOptions.announceEmpty} */
  change: [match: Id | null, previous: Id | null]
  /** the position entered the fence of a tracked match */
  enter: [id: Id]
  /** the position left the fence of a tracked match */
  leave: [id: Id]
}

export type GeofenceSessionOptions<Id = string> = {
  /**
   * whether a position leaving every fence counts: it emits `leave` and `change` to null
   *
   * If `false`, positions without any match are ignored, so the session keeps its last match, like a room while walking through a passage between two rooms.
   */
  announceEmpty?: boolean
  /**
   * the match to start with instead of null, like a room restored from a saved game
   *
   * Set silently: the first {@link GeofenceSession.update} compares against it, so it emits nothing if the position is still in that fence.
   */
  initialValue?: Id | null
}

/** Follows a moving position through geofences and reports when its first match changes. */
export default class GeofenceSession<Id = string, Value extends Fence = Fence> extends EventEmitter<GeofenceSessionEvents<Id>> {
  readonly announceEmpty: boolean
  protected currentMatch: Id | null
  readonly geofences: GeofenceCollection<Id, Value>

  constructor(geofences: GeofenceCollection<Id, Value>, {announceEmpty = false, initialValue = null}: GeofenceSessionOptions<NoInfer<Id>> = {}) {
    super()
    this.geofences = geofences
    this.announceEmpty = announceEmpty
    this.currentMatch = initialValue
  }

  /** the id of the first fence that contained the last counted position, or null */
  get match() {
    return this.currentMatch
  }

  /**
   * Moves to the position: if its first match changed, emits `leave` for the old one, then `enter` for the new one, then `change`.
   * Listeners already see the new state. Returns the {@link match}.
   */
  update(position: Position) {
    const match = this.geofences.getMatch(position)
    if (match === this.currentMatch || match === null && !this.announceEmpty) {
      return this.currentMatch
    }
    const previous = this.currentMatch
    this.currentMatch = match
    if (previous !== null) {
      this.emit('leave', previous)
    }
    if (match !== null) {
      this.emit('enter', match)
    }
    this.emit('change', match, previous)
    return match
  }
}
