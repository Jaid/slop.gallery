import {Geofence} from 'geofency'
import {Box3} from 'three/webgpu'

import {apseOpeningPoint, apseOpenings, bastionCurve, bastionOrigin} from '#src/lib/gallery/bastion.ts'
import {bastionNetwork, lodgeSpur} from '#src/lib/gallery/bastionNetwork.ts'
import {cisternAir} from '#src/lib/gallery/cistern/cistern.ts'

import chunkBoxes from '../lib/chunkBoxes.ts'
import footprint from '../lib/footprint.ts'

/** the line across the curve through the middle of the gate in the crown of the Oculus’ apse, on the apse wall’s center line, in the museum’s meters */
const [, gateZ] = apseOpeningPoint(apseOpenings.find(({name}) => name === 'gate')!)
/** How far a passage’s air boxes may reach past its walls, short of the Oculus’ apse beside the curve. */
const slack = 0.35
const passages = chunkBoxes(bastionNetwork.filter(passage => passage !== lodgeSpur).flatMap(passage => passage.chunks(slack)), bastionOrigin)
const alley = chunkBoxes(lodgeSpur.chunks(slack), bastionOrigin)
const cistern = chunkBoxes([cisternAir], bastionOrigin)
export const bastionAir = [...passages, ...alley, ...cistern]

/** From a meter under the floor to half a meter over the vault, keeping stacked passages apart. */
const fenceBox = (box: Box3) => ({
  ...footprint([box]),
  y: box.min.y - 1,
  y2: box.max.y + 0.5,
})
const fences = {
  /** The knight’s alley: the blind branch beside the Lodge, where the empty suit of armor stands with the knight’s helmet on its shoulders, from its doorway in the connecting tunnel’s wall up its ramp, past the Lodge’s side window and on to its closing wall with the barred window. */
  knight_alley: new Geofence([fenceBox(alley.reduce((bounds, box) => bounds.union(box), new Box3))]),
  /** The cistern behind the Forge’s vestibule, which the alchemy machine shoots its orbs into: from its flat wall with the window onto the vestibule to its round wall under the half dome. */
  cistern: new Geofence(cistern.map(fenceBox)),
  /** The curve behind the crown of the Oculus’ apse, where the barred gate and the windows beside it look out over the platform and down the Oculus: north of the gate, out to the curve’s outer walls, from the corner behind the apse’s east shoulder to the chamfer before the S bend, in the curve’s own boxes cut off along the gate. */
  gate: new Geofence(chunkBoxes(bastionCurve.chunks(slack).filter(({min}) => min[2] < gateZ).map(({min, max}) => ({
    min,
    max: [max[0], max[1], Math.min(max[2], gateZ)] as const,
  })), bastionOrigin).map(fenceBox)),
} satisfies Record<string, Geofence>

export const bastionFence = new Geofence([...passages.map(fenceBox), ...fences.knight_alley.boxes, ...fences.cistern.boxes])
export default fences
