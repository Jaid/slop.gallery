import type {SculptureModelProps} from '#src/sculptures/index.ts'

import Orbitable from '#component/Orbitable'
import {salonCeiling} from '#src/lib/gallery/salon.ts'
import {salonSculpture, salonSculptureSpot} from '#src/lib/gallery/salonSculpture.ts'

const Model = await salonSculpture.loadModel()
const orbit = {
  radius: Math.hypot(...salonSculpture.size) / 2,
  floorY: salonSculptureSpot[1],
  ceilingY: salonCeiling.underside,
}

/** The Salon supplies the placement and inspection target; the selected model supplies the sculpture, not its socket. */
export default function SalonSculpture({material}: SculptureModelProps) {
  return <Orbitable id='salon-sculpture' center={[0, salonSculpture.size[1] / 2, 0]} name='salon-sculpture' orbit={orbit} position={salonSculptureSpot} title={salonSculpture.title}>
    <Model material={material} />
  </Orbitable>
}
