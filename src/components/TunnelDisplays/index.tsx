import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import hsl from 'okhsl'

import DisplayStairway from '#component/DisplayStairway'
import SlopedBox from '#component/SlopedBox'
import Box from '#src/components/Scene/primitives.tsx'
import lowerGallery, {tunnelDiagonalFloorY, tunnelDiagonalPoint, tunnelDiagonalYaw, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'
import tunnelDisplays from '#src/lib/gallery/tunnelDisplays.ts'
import lamps, {tunnelLightSs} from '#src/rooms/exhibition/lamps.ts'

/** Housing colors in order up the tunnel’s diagonal ceiling. */
const tunnelLightColors = [lamps.tunnel_north, lamps.tunnel_middle, lamps.tunnel_south].map(lamp => lamp.tint)

export default function TunnelDisplays({material}: {material: Material}) {
  return <group name='tunnel-displays'>
    {tunnelDisplays.map(display => <group key={display.side} name={`tunnel-display-${display.side}`}>
      <RigidBody colliders={false} type='fixed'>
        {display.shell.map(({position, rotation, size}, i) => <group key={i} position={position} rotation={rotation}>
          <SlopedBox material={material} position={[0, 0, 0]} size={size} slope={tunnelSlope} />
        </group>)}
      </RigidBody>
      <DisplayStairway material={material} stairway={display.stairway} />
    </group>)}
    {tunnelLightSs.map((s, i) => {
      const [x, z] = tunnelDiagonalPoint(s)
      return <group key={s} name='tunnel-ceiling-light' position={[x, tunnelDiagonalFloorY(s) + lowerGallery.tunnel.height, z]} rotation={[0, tunnelDiagonalYaw, 0]}>
        <group rotation={[-Math.atan(tunnelSlope), 0, 0]}>
          <Box color={hsl.integer(216, 16, 19)} position={[0, -0.04, 0]} size={[0.5, 0.1, 0.5]} />
          <mesh position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.16, 24]} /><meshBasicNodeMaterial color={tunnelLightColors[i]} toneMapped={false} />
          </mesh>
        </group>
      </group>
    })}
  </group>
}
