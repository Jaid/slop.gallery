import type GeofenceCollection from './GeofenceCollection.ts'
import type {GeofenceSessionOptions} from './GeofenceSession.ts'
import type {Fence, Position} from './types.ts'

import GeofenceSession from './GeofenceSession.ts'

export type MultimatchGeofenceSessionOptions<Id = string> = Omit<GeofenceSessionOptions<Id>, 'initialValue'> & {
  /**
   * the match or matches to start with, the first one as {@link MultimatchGeofenceSession.match}
   *
   * Set silently: the first {@link MultimatchGeofenceSession.update} compares against them. An array rather than any iterable, so that a string id never gets split into its characters.
   */
  initialValue?: Id | ReadonlyArray<Id> | null
}

const toMatches = <Id>(value: Id | ReadonlyArray<Id> | null): ReadonlySet<Id> => {
  if (value === null) {
    return new Set
  }
  return new Set(Array.isArray(value) ? value as ReadonlyArray<Id> : [value as Id])
}

/** A {@link GeofenceSession} that follows every fence containing the position, not just the first one. */
export default class MultimatchGeofenceSession<Id = string, Value extends Fence = Fence> extends GeofenceSession<Id, Value> {
  private currentMatches: ReadonlySet<Id>

  constructor(geofences: GeofenceCollection<Id, Value>, {initialValue = null, ...options}: MultimatchGeofenceSessionOptions<NoInfer<Id>> = {}) {
    const matches = toMatches(initialValue)
    super(geofences, {
      ...options,
      initialValue: matches.values().next().value ?? null,
    })
    this.currentMatches = matches
  }

  /** the ids of every fence that contained the last counted position, in insertion order */
  get matches(): ReadonlySet<Id> {
    return this.currentMatches
  }

  /**
   * Moves to the position: emits `leave` for every fence left, then `enter` for every fence entered, then `change` if the first match changed.
   * Listeners already see the new state. Returns the {@link match}.
   */
  override update(position: Position) {
    const matches = new Set(this.geofences.getMatches(position))
    if (!matches.size && !this.announceEmpty) {
      return this.currentMatch
    }
    const previous = this.currentMatches
    const previousMatch = this.currentMatch
    const match = matches.values().next().value ?? null
    this.currentMatches = matches
    this.currentMatch = match
    for (const id of previous) {
      if (!matches.has(id)) {
        this.emit('leave', id)
      }
    }
    for (const id of matches) {
      if (!previous.has(id)) {
        this.emit('enter', id)
      }
    }
    if (match !== previousMatch) {
      this.emit('change', match, previousMatch)
    }
    return match
  }
}
