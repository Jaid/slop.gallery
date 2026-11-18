import type {SculptureModelProps} from '#src/sculptures/index.ts'
import type {RapierRigidBody} from '@react-three/rapier'

import {RigidBody} from '@react-three/rapier'
import {useRef} from 'react'

import Orbitable from '#component/Orbitable'
import {salonSkylight} from '#src/lib/gallery/salon.ts'
import {salonSculpture, salonSculptureSpot} from '#src/lib/gallery/salonSculpture.ts'

const Model = await salonSculpture.loadModel()
const orbit = {
  radius: Math.hypot(...salonSculpture.size) / 2,
  ceilingY: salonSkylight.footY,
}

/** The Salon supplies the placement and inspection target; the selected model supplies the sculpture, not its socket. */
export default function SalonSculpture({material}: Pick<SculptureModelProps, 'material'>) {
  const body = useRef<RapierRigidBody>(null)
  return <RigidBody colliders={false} position={salonSculptureSpot} type='dynamic' ref={body}>
    <Orbitable id='salon-sculpture' bodyRef={body} center={[0, salonSculpture.size[1] / 2, 0]} name='salon-sculpture' orbit={orbit} title={salonSculpture.title}>
      <Model mass={salonSculpture.mass} material={material} />
    </Orbitable>
  </RigidBody>
}
