import {Geofence} from 'geofency'

import {climbApproach} from '#src/lib/gallery/climb.ts'

/** The gallery’s fences beside its rooms’, by their ids, in the museum’s meters. They mark places where something happens, whatever room they lie in. */
const fences = {
  /**
   * Where arriving in the Forge is imminent: the Bastion’s approach, from the end of its run north behind the Forge’s west wall, round the turn east and on to the west arch of the Forge’s vestibule, the only way into the Forge on foot.
   * Its air in the same boxes the Bastion fences it with, from a meter under its floor to half a meter over its vault, so it lies within the Bastion’s fence.
   */
  imminent_forge: new Geofence(climbApproach.chunks(0.35).map(({min, max}) => ({
    x: min[0],
    z: min[2],
    x2: max[0],
    z2: max[2],
    y: min[1] - 1,
    y2: max[1] + 0.5,
  }))),
} as const satisfies Record<string, Geofence>

export default fences
