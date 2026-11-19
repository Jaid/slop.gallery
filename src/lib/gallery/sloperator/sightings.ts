import type {Vec3} from '../types.ts'
import type {SloperatorSight, SloperatorSightId} from './sights.ts'

import {create} from 'zustand'

import {onGeofenceLeave, useGeofence} from '../geofences.ts'
import sights from './sights.ts'

/** the player catching sight of the Sloperator */
export type Sighting = {
  /** how far from the eye he sat, in meters */
  distance: number
  /** where the eye was, in the museum’s meters */
  position: Vec3
  /** the id of the sight he sat at */
  sight: SloperatorSightId
}

type SloperatorState = {
  /** how the player caught sight of him at the sights whose fence the player has not left since, each once */
  sighted: ReadonlyArray<Sighting>
  /** the ids of the sights he left a Slop at, which he never returns to */
  slopped: ReadonlyArray<SloperatorSightId>
}

/**
 * What became of the Sloperator’s sights in this game. He sits at a sight while the player’s place is in its fence. Aiming at him there changes nothing to see, see {@link sightSloperator}, but once the player leaves that fence again, he leaves a Slop where he sat and never returns to that sight; his other sights go on as before.
 */
export const useSloperator = create<SloperatorState>(() => ({
  sighted: [],
  slopped: [],
}))

// Leaving a sight’s fence is all that makes him go for good, and only moving out of it counts, like for every fence.
for (const {fence, id} of sights) {
  onGeofenceLeave(fence, () => {
    const {sighted, slopped} = useSloperator.getState()
    if (sighted.some(({sight}) => sight === id)) {
      useSloperator.setState({
        sighted: sighted.filter(({sight}) => sight !== id),
        slopped: [...slopped, id],
      })
    }
  })
}

/**
 * Takes down that the player caught sight of him at a sight, which whoever draws him there calls as the middle of the view meets him, with nothing but glass in between.
 * Only the first time at a sight counts, and none where he left his Slop already; returns whether it did.
 */
export function sightSloperator(sighting: Sighting) {
  const {sighted, slopped} = useSloperator.getState()
  if (slopped.includes(sighting.sight) || sighted.some(({sight}) => sight === sighting.sight)) {
    return false
  }
  useSloperator.setState({sighted: [...sighted, sighting]})
  return true
}

/** Whether he sits at the sight right now, for a component to render by: while the player’s place is in its fence, unless he left his Slop there. */
export function useSloperatorSeated({fence, id}: Pick<SloperatorSight, 'fence'> & {id: SloperatorSightId}) {
  const watched = useGeofence(fence)
  const slopped = useSloperator(state => state.slopped.includes(id))
  return watched && !slopped
}
