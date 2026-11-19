import {Geofence} from 'geofency'

import {lodgeSpur} from '#src/lib/gallery/bastionNetwork.ts'

/** The gallery’s fences beside its rooms’, by their ids, in the museum’s meters. They mark places where something happens, whatever room they lie in. */
const fences = {
  /**
   * The knight’s alley: the Bastion’s blind branch beside the Lodge, where the empty suit of armor stands with the knight’s helmet on its shoulders, from its doorway in the connecting tunnel’s wall up its ramp, past the Lodge’s side window and on to its closing wall with the barred window.
   * Its air in the same boxes the Bastion fences it with, from a meter under its floor to half a meter over its vault, so it lies within the Bastion’s fence.
   */
  knight_alley: new Geofence(lodgeSpur.chunks(0.35).map(({min, max}) => ({
    x: min[0],
    z: min[2],
    x2: max[0],
    z2: max[2],
    y: min[1] - 1,
    y2: max[1] + 0.5,
  }))),
} as const satisfies Record<string, Geofence>

export default fences
