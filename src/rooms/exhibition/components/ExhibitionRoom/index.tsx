import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import TunnelDisplays from '#component/TunnelDisplays'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {ExhibitionBevelCornerGeometry, ExhibitionTunnelSlabGeometry} from '#src/lib/gallery/ExhibitionTunnelGeometry.ts'
import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import ExhibitionPedestals from '#src/rooms/exhibition/components/ExhibitionPedestals/index.tsx'

const {tunnel} = lowerGallery

/** The beveled tunnel’s floor and ceiling, with the displays on either side, their pedestals and their asymmetric staff stairways. */
export default function ExhibitionRoom({material}: {material: Material}) {
  const floor = useDisposable(useMemo(() => new ExhibitionTunnelSlabGeometry(0, 0.24), []))
  const ceiling = useDisposable(useMemo(() => new ExhibitionTunnelSlabGeometry(tunnel.height + 0.18, 0.18), []))
  const bevelCorners = useDisposable(useMemo(() => new ExhibitionBevelCornerGeometry, []))
  const floorCollider = useMemo(() => colliderGeometry(floor), [floor])
  const ceilingCollider = useMemo(() => colliderGeometry(ceiling), [ceiling])
  const bevelCollider = useMemo(() => colliderGeometry(bevelCorners), [bevelCorners])
  return <group name='exhibition-room'>
    <TunnelDisplays material={material} />
    <ExhibitionPedestals material={material} />
    <RigidBody colliders={false} type='fixed'>
      <mesh castShadow geometry={floor} material={material} name='exhibition-floor' receiveShadow />
      <MeshSurfaceCollider args={floorCollider} />
      <mesh castShadow geometry={ceiling} material={material} name='exhibition-ceiling' receiveShadow />
      <MeshSurfaceCollider args={ceilingCollider} />
      <mesh castShadow geometry={bevelCorners} material={material} name='exhibition-bevel-corners' receiveShadow />
      <MeshSurfaceCollider args={bevelCollider} />
    </RigidBody>
  </group>
}
