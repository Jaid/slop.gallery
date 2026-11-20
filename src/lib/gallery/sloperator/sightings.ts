import type {SloperatorDump} from '../../webmcp/sloperator.ts'
import type {Vec3} from '../types.ts'
import type {BodyPose, SloperatorPlacement, SloperatorPose, SloperatorSpawn} from './placement.ts'
import type {SloperatorFurniture, SloperatorSight, SloperatorSightId} from './sights.ts'

import {create} from 'zustand'

import {onGeofenceLeave, useGeofence, useGeofences} from '../geofences.ts'
import {seatStrayed} from './placement.ts'
import sights from './sights.ts'

/** the player catching sight of the Sloperator */
export type Sighting = {
  /** how far from the eye he was, in meters */
  distance: number
  /** how he sat or stood */
  pose: SloperatorPose
  /** where the eye was, in the museum’s meters */
  position: Vec3
  /** the id of the sight he was at */
  sight: SloperatorSightId
}

type SloperatorState = {
  /** the sights the `spawn_sloperator` tool brought him to, where he is whatever fence the player is in, until he leaves his Slop there */
  pinned: ReadonlyArray<SloperatorSightId>
  /** how the player caught sight of him at the sights whose fence the player has not left since, each once */
  sighted: ReadonlyArray<Sighting>
  /** where he was at each sight he left a Slop at, which he never returns to */
  slopped: Partial<Record<SloperatorSightId, SloperatorPlacement>>
  /** what became of the player entering each sight’s fence the player is in, once the physics told, see `placement.ts`: where he turns up there, or what keeps him away until the player enters that fence anew */
  spawns: Partial<Record<SloperatorSightId, SloperatorSpawn>>
}

/**
 * What became of the Sloperator’s sights in this game. He turns up at a sight while the player’s place is in its fence, as the physics placed him on entering it. Once the player caught sight of him there, see {@link sightSloperator}, he gets up or brings his hands behind his back, and once the player leaves that fence again, he leaves a Slop where he was and never returns to that sight; his other sights go on as before.
 */
export const useSloperator = create<SloperatorState>(() => ({
  pinned: [],
  sighted: [],
  slopped: {},
  spawns: {},
}))

/** Where he turns up at the sight, as the physics placed him on the player entering its fence, if he does. */
export function placementAt(spawns: SloperatorState['spawns'], id: SloperatorSightId) {
  const spawn = spawns[id]
  return spawn?.result === 'success' ? spawn.placement : undefined
}

// Leaving a sight’s fence is all that makes him go for good, and only moving out of it counts, like for every fence.
for (const {fence, id} of sights) {
  onGeofenceLeave(fence, () => {
    const {pinned, sighted, slopped, spawns} = useSloperator.getState()
    const placement = placementAt(spawns, id)
    if (placement && sighted.some(({sight}) => sight === id)) {
      useSloperator.setState({
        pinned: pinned.filter(sight => sight !== id),
        sighted: sighted.filter(({sight}) => sight !== id),
        slopped: {
          ...slopped,
          [id]: placement,
        },
      })
    }
  })
}
// Out of a sight’s fence, however the player got out, he is placed anew on entering it again, unless pinned there. Subscribed after leaving a fence takes down where he left his Slop.
useGeofences.subscribe(({fences}) => {
  const {pinned, spawns} = useSloperator.getState()
  const kept = Object.entries(spawns).filter(([id]) => pinned.includes(id as SloperatorSightId) || fences.includes(sights.find(sight => sight.id === id)!.fence))
  if (kept.length < Object.keys(spawns).length) {
    useSloperator.setState({spawns: Object.fromEntries(kept)})
  }
})

/** Takes down what became of the player entering the sight’s fence, as the physics found. */
export function spawnAtSight(id: SloperatorSightId, spawn: SloperatorSpawn) {
  const {spawns} = useSloperator.getState()
  useSloperator.setState({
    spawns: {
      ...spawns,
      [id]: spawn,
    },
  })
}

/** Whether the physics has yet to place him at the sight: the player’s place is in its fence, or the sight is pinned, nothing placed him there since the player entered it, and he has not left his Slop there. */
export function awaitsSpawn({fence, id}: Pick<SloperatorSight, 'fence'> & {id: SloperatorSightId}) {
  const {pinned, slopped, spawns} = useSloperator.getState()
  return spawns[id] === undefined && !Object.hasOwn(slopped, id) && (pinned.includes(id) || useGeofences.getState().fences.includes(fence))
}

/**
 * Pins the sight for the `spawn_sloperator` tool: forgets that the player caught sight of him there and the Slop he left there, if any, and where he was placed, so the physics places him there anew, and keeps him there whatever fence the player is in, until the player leaves its fence after catching sight of him, which leaves his Slop as ever.
 */
export function pinSight(id: SloperatorSightId) {
  const {pinned, sighted, slopped, spawns} = useSloperator.getState()
  useSloperator.setState({
    pinned: pinned.includes(id) ? pinned : [...pinned, id],
    sighted: sighted.filter(({sight}) => sight !== id),
    slopped: Object.fromEntries(Object.entries(slopped).filter(([sight]) => sight !== id)),
    spawns: Object.fromEntries(Object.entries(spawns).filter(([sight]) => sight !== id)),
  })
}

/**
 * Takes down that the player caught sight of him at a sight, which whoever draws him there calls as the middle of the view meets him while the player is zoomed in all the way, with nothing but glass in between, or the `trigger_sloperator_sighting` tool.
 * Only the first time at a sight counts, and none where he left his Slop already; returns whether it did.
 */
export function sightSloperator(sighting: Sighting) {
  const {sighted, slopped} = useSloperator.getState()
  if (Object.hasOwn(slopped, sighting.sight) || sighted.some(({sight}) => sight === sighting.sight)) {
    return false
  }
  useSloperator.setState({sighted: [...sighted, sighting]})
  return true
}

/** What he is up to at each of the sights, and how far his seat strayed where `seatPose` tells how the furniture stands, for the `dump_sloperator` tool. */
export function dumpSightings(present: ReadonlyArray<SloperatorSight & {id: SloperatorSightId}>, seatPose: (furniture: SloperatorFurniture) => BodyPose | undefined): Array<SloperatorDump> {
  const {fences} = useGeofences.getState()
  const {pinned, sighted, slopped, spawns} = useSloperator.getState()
  const stateOf = ({fence, id}: typeof present[number]): SloperatorDump['state'] => {
    const spawn = spawns[id]
    if (Object.hasOwn(slopped, id)) {
      return 'slopped'
    }
    if (!fences.includes(fence) && !pinned.includes(id)) {
      return 'away'
    }
    if (!spawn) {
      return 'waiting'
    }
    if (spawn.result === 'failure') {
      return 'kept_away'
    }
    return spawn.placement.pose === 'stand' ? 'standing' : 'seated'
  }
  const strayedAt = (sight: SloperatorSight) => {
    if (!sight.furniture) {
      return
    }
    const pose = seatPose(sight.furniture)
    return pose && seatStrayed(sight, pose)
  }
  return present.map(sight => {
    const where = slopped[sight.id] ?? placementAt(spawns, sight.id)
    const spawn = spawns[sight.id]
    const strayed = strayedAt(sight)
    return {
      fence: sight.fence,
      id: sight.id,
      ...spawn ? {detection: spawn.detection} : {},
      ...where ? {
        pose: where.pose,
        position: [...where.position],
        yaw: where.yaw,
      } : {},
      ...strayed ? {
        seat: {
          moved: strayed.moved,
          tilted: strayed.tilted,
          turned: strayed.turned,
        },
      } : {},
      pinned: pinned.includes(sight.id),
      sighted: sighted.some(({sight: id}) => id === sight.id),
      state: stateOf(sight),
    }
  })
}

/** Whether the player’s place is in the sight’s fence, or the sight is pinned, while he has not left his Slop there yet, which is when he turns up there, for a component to render by. */
export function useSightWatched({fence, id}: Pick<SloperatorSight, 'fence'> & {id: SloperatorSightId}) {
  const watched = useGeofence(fence)
  const pinned = useSloperator(state => state.pinned.includes(id))
  const slopped = useSloperator(state => Object.hasOwn(state.slopped, id))
  return (watched || pinned) && !slopped
}
