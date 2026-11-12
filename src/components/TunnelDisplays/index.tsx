import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'

import DisplayStairway from '#component/DisplayStairway'
import SlopedBox from '#component/SlopedBox'
import Box from '#src/components/Scene/primitives.tsx'
import {tunnelFloorHeight, tunnelFrame, tunnelSlope} from '#src/lib/gallery/exhibitionTunnel.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'
import lamps, {tunnelLampZs} from '#src/rooms/exhibition/lamps.ts'

const tunnelLightColors = [lamps.tunnel_green, lamps.tunnel_blue, lamps.tunnel_red].map(lamp => lamp.tint)

/** The displays behind the tunnel’s side walls along its diagonal, with their stairways, and the three housings on the tunnel’s ceiling between their rows of exhibits, whose plain colored lights light both displays at once; all laid out in the diagonal’s frame. */
export default function TunnelDisplays({material}: {material: Material}) {
  const [originX, originZ] = tunnelFrame.origin
  return <group name='tunnel-displays'>
    {tunnelDisplays.map(display => <group key={display.side} name={`tunnel-display-${display.side}`}>
      <RigidBody colliders={false} position={[originX, 0, originZ]} rotation={[0, tunnelFrame.yaw, 0]} type='fixed'>
        {display.shell.map(({position, size}, i) => <SlopedBox key={i} material={material} position={position} size={size} slope={tunnelSlope} />)}
      </RigidBody>
      <DisplayStairway material={material} stairway={display.stairway} />
    </group>)}
    <group position={[originX, 0, originZ]} rotation={[0, tunnelFrame.yaw, 0]}>
      {tunnelLampZs.map((z, i) => <group key={z} name='tunnel-ceiling-light' position={[0, tunnelFloorHeight(z) + lowerGallery.tunnel.height, z]} rotation={[-Math.atan(tunnelSlope), 0, 0]}>
        <Box color='#242f32' position={[0, -0.04, 0]} size={[0.5, 0.1, 0.5]} />
        <mesh position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 24]} /><meshBasicNodeMaterial color={tunnelLightColors[i]} toneMapped={false} />
        </mesh>
      </group>)}
    </group>
  </group>
}
