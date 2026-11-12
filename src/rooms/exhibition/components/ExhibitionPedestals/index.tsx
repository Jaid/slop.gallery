import type {Vec3} from 'math'
import type {Material} from 'three/webgpu'

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import DisplayPedestalGeometry from '#src/lib/gallery/DisplayPedestalGeometry.ts'
import {tunnelSkew, tunnelSlope} from '#src/lib/gallery/lowerGallery.ts'
import {exhibitionPedestal, exhibitionPedestalLobes, exhibitionSlots} from '#src/rooms/exhibition/exhibits.ts'

type PedestalMaterials = Record<'cap' | 'reveal' | 'stone', Material>

/** The Exhibition’s six half-round pedestals against their displays’ back walls, each with the lower sidecar for a nameplate merged into its north flank, waiting for their exhibits. */
export default function ExhibitionPedestals({material}: {material: Material}) {
  const reveal = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#1f2628',
    roughness: 0.85,
  }), []))
  const cap = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#788586',
    metalness: 0.65,
    roughness: 0.35,
  }), []))
  const materials = {
    cap,
    reveal,
    stone: material,
  }
  const pedestals = {
    [-1]: usePedestalGeometry(-1),
    1: usePedestalGeometry(1),
  }
  return <group name='exhibition-pedestals'>
    {exhibitionSlots.map(slot => <Pedestal key={slot.id} geometry={pedestals[slot.direction]} materials={materials} name={`${slot.id}-pedestal`} position={slot.pedestal} />)}
  </group>
}

function usePedestalGeometry(direction: -1 | 1) {
  return useDisposable(useMemo(() => new DisplayPedestalGeometry({
    direction,
    lobes: exhibitionPedestalLobes,
    plinth: exhibitionPedestal.plinth,
    slope: tunnelSlope,
    skew: tunnelSkew,
  }), [direction]))
}
function Pedestal({geometry, materials, name, position}: {
  geometry: DisplayPedestalGeometry
  materials: PedestalMaterials
  name: string
  position: Vec3
}) {
  return <RigidBody colliders={false} name={name} position={position} type='fixed'>
    {geometry.collision.map((args, i) => <MeshSurfaceCollider key={i} args={args} />)}
    <mesh castShadow geometry={geometry.stone} material={materials.stone} receiveShadow />
    <mesh castShadow geometry={geometry.reveal} material={materials.reveal} receiveShadow />
    <mesh castShadow geometry={geometry.cap} material={materials.cap} receiveShadow />
  </RigidBody>
}
