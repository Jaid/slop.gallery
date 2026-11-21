import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {apseOpeningPoint, apseOpenings, bastionCurve, bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {lodgeSpur} from '#src/lib/gallery/bastionNetwork.ts'
import {cisternAir} from '#src/lib/gallery/cistern/cistern.ts'

import chunkBoxes from '../lib/chunkBoxes.ts'
import footprint from '../lib/footprint.ts'

/** the line across the curve through the middle of the gate in the crown of the Oculus’ apse, on the apse wall’s center line, in the museum’s meters */
const [, gateZ] = apseOpeningPoint(apseOpenings.find(({name}) => name === 'gate')!)
/** A part of the Bastion around chunks of its air given in the museum’s meters, in the same boxes the Bastion fences them with: from a meter under their floor to half a meter over their vault, so it lies within the Bastion’s fence. */
function part(chunks: ReadonlyArray<{
  max: Readonly<Vec3>
  min: Readonly<Vec3>
}>) {
  return new Geofence(chunkBoxes(chunks, bastionOrigin).map(box => ({
    ...footprint([box]),
    y: box.min.y - 1,
    y2: box.max.y + 0.5,
  })))
}

export default {
  /** The knight’s alley: the blind branch beside the Lodge, where the empty suit of armor stands with the knight’s helmet on its shoulders, from its doorway in the connecting tunnel’s wall up its ramp, past the Lodge’s side window and on to its closing wall with the barred window. */
  knight_alley: part(lodgeSpur.chunks(0.35)),
  /** The cistern behind the Forge’s vestibule, which the alchemy machine shoots its orbs into: from its flat wall with the window onto the vestibule to its round wall under the half dome. */
  cistern: part([cisternAir]),
  /** The curve behind the crown of the Oculus’ apse, where the barred gate and the windows beside it look out over the platform and down the Oculus: north of the gate, out to the curve’s outer walls, from the corner behind the apse’s east shoulder to the chamfer before the S bend, in the curve’s own boxes cut off along the gate. */
  gate: part(bastionCurve.chunks(0.35).filter(({min}) => min[2] < gateZ).map(({min, max}) => ({
    min,
    max: [max[0], max[1], Math.min(max[2], gateZ)] as const,
  }))),
} satisfies Record<string, Geofence>
