import type {Material} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import lodge from '#src/lib/gallery/lodge.ts'
import LodgeCeilingGeometry from '#src/lib/gallery/lodgeInterior/LodgeCeilingGeometry.ts'

/** The hewn beams under the Lodge’s ceiling, in the room’s frame. */
export default function LodgeCeiling({material}: {material: Material}) {
  const ceiling = useDisposable(useMemo(() => new LodgeCeilingGeometry, []))
  return <group name='lodge-ceiling-framing' position={[0, lodge.height, 0]}>
    {ceiling.members.map(({geometry, name, position, yaw}, index) => <mesh key={index} castShadow geometry={geometry} material={material} name={name} position={position} receiveShadow rotation={[0, yaw, 0]} />)}
  </group>
}
