import type {MinimapProps} from '#src/worlds/base/World.ts'

import Branch from 'branch-component'

import KnotStudyMap from '#component/KnotStudyMap'

/** The exhibition hall with its Knots and the player in it, on the map’s upper side only, as Knottingham has a single floor. */
export default function KnottinghamMinimap({lower, pose}: Pick<MinimapProps, 'lower' | 'pose'>) {
  return <Branch not={lower}><KnotStudyMap compact pose={pose} /></Branch>
}
