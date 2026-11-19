import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {useGeofence} from '#src/lib/gallery/geofences.ts'
import lodgeInterior from '#src/lib/gallery/lodgeInterior/layout.ts'
import StrangerGeometry from '#src/lib/gallery/lodgeInterior/StrangerGeometry.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'

const {armchairSpread, seatWidth, strangerSeat} = lodgeInterior
/**
 * The stranger in the Lodge’s armchair in front of the east window, his back to it: a man in a dark overcoat and a bowler, whom the Bastion’s knight’s alley sees through that window, his hat and his head over its sill.
 * He only sits there while the player is in that alley, the gallery’s `knight_alley` fence: he appears as the player enters it and is gone as soon as the player leaves it, so nobody ever finds him in the room.
 */
export default function LodgeStranger() {
  const watched = useGeofence('knight_alley')
  return <Branch if={watched} then={Stranger} />
}

/** The man himself in his armchair, in the room’s frame, made when he appears and disposed of when he is gone. He is nothing to bump into: nobody is in the room while he is. */
function Stranger() {
  const geometry = useDisposable(useMemo(() => new StrangerGeometry(seatWidth + armchairSpread), []))
  const cloth = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial({
    color: '#1d1c21',
    roughness: 0.92,
  })), []))
  const skin = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial({
    color: '#b79d8c',
    roughness: 0.7,
  })), []))
  return <group name='lodge-stranger' position={strangerSeat.position} rotation={[0, strangerSeat.yaw, 0]}>
    <mesh castShadow geometry={geometry.cloth} material={cloth} name='lodge-stranger-cloth' receiveShadow />
    <mesh castShadow geometry={geometry.skin} material={skin} name='lodge-stranger-skin' receiveShadow />
  </group>
}
