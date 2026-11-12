import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'

import SlopedBox from '#component/SlopedBox'
import TunnelDisplays from '#component/TunnelDisplays'
import lowerGallery, {tunnelCenter, tunnelSkew, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'
import ExhibitionPedestals from '#src/rooms/exhibition/components/ExhibitionPedestals/index.tsx'

const {tunnel} = lowerGallery
const [centerX, centerY, centerZ] = tunnelCenter

/** The tunnel’s sloping floor and ceiling, with the displays on either side, their pedestals and their stairways. */
export default function ExhibitionRoom({material}: {material: Material}) {
  return <group name='exhibition-room'>
    <TunnelDisplays material={material} />
    <ExhibitionPedestals material={material} />
    <RigidBody colliders={false} type='fixed'>
      <SlopedBox material={material} name='exhibition-floor' position={[centerX, centerY - 0.12, centerZ]} size={[tunnel.width, 0.24, tunnel.southZ - tunnel.northZ]} skew={tunnelSkew} slope={tunnelSlope} />
      <SlopedBox material={material} name='exhibition-ceiling' position={[centerX, centerY + tunnel.height + 0.09, centerZ]} size={[tunnel.width, 0.18, tunnel.southZ - tunnel.northZ]} skew={tunnelSkew} slope={tunnelSlope} />
    </RigidBody>
  </group>
}
