import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'

import SlopedBox from '#component/SlopedBox'
import TunnelDisplays from '#component/TunnelDisplays'
import lowerGallery, {tunnelCenter, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'

const {tunnel} = lowerGallery
const [, centerY, centerZ] = tunnelCenter

/** The tunnel’s sloping floor and ceiling, with the displays on either side, their pedestals and their stairways. */
export default function ExhibitionRoom({material}: {material: Material}) {
  return <group name='exhibition-room'>
    <TunnelDisplays material={material} />
    <RigidBody colliders={false} type='fixed'>
      <SlopedBox material={material} name='exhibition-floor' position={[tunnel.x, centerY - 0.12, centerZ]} size={[tunnel.width, 0.24, tunnel.southZ - tunnel.northZ]} slope={tunnelSlope} />
      <SlopedBox material={material} name='exhibition-ceiling' position={[tunnel.x, centerY + tunnel.height + 0.09, centerZ]} size={[tunnel.width, 0.18, tunnel.southZ - tunnel.northZ]} slope={tunnelSlope} />
    </RigidBody>
  </group>
}
