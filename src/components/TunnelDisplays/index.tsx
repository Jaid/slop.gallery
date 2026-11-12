import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'

import DisplayStairway from '#component/DisplayStairway'
import SlopedBox from '#component/SlopedBox'
import Box from '#src/components/Scene/primitives.tsx'
import lowerGallery, {tunnelFloorHeight, tunnelSkew, tunnelSlope, tunnelX} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'
import lamps from '#src/rooms/exhibition/lamps.ts'

/** Three housings on the tunnel’s ceiling, abreast of each row of exhibits, whose plain colored lights light both displays at once. */
const tunnelLightZs = tunnelDisplays[0].exhibits.map(exhibit => exhibit.position[2])
const tunnelLightColors = [lamps.tunnel_green, lamps.tunnel_blue, lamps.tunnel_red].map(lamp => lamp.tint)

export default function TunnelDisplays({material}: {material: Material}) {
  return <group name='tunnel-displays'>
    {tunnelDisplays.map(display => <group key={display.side} name={`tunnel-display-${display.side}`}>
      <RigidBody colliders={false} type='fixed'>
        {display.shell.map(({position, size}, i) => <group key={i}>
          <SlopedBox material={material} position={position} size={size} skew={tunnelSkew} slope={tunnelSlope} />
        </group>)}
      </RigidBody>
      <DisplayStairway material={material} stairway={display.stairway} />
    </group>)}
    {tunnelLightZs.map((z, i) => <group key={z} name='tunnel-ceiling-light' position={[tunnelX(z), tunnelFloorHeight(z) + lowerGallery.tunnel.height, z]} rotation={[-Math.atan(tunnelSlope), 0, 0]}>
      <Box color='#242f32' position={[0, -0.04, 0]} size={[0.5, 0.1, 0.5]} />
      <mesh position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 24]} /><meshBasicNodeMaterial color={tunnelLightColors[i]} toneMapped={false} />
      </mesh>
    </group>)}
  </group>
}
