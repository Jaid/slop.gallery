import type PassageTransition from '#src/lib/gallery/passages/PassageTransition.ts'
import type {Material, Object3D} from 'three/webgpu'

import {ConvexHullCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import TransitionGeometry from '#src/lib/gallery/passages/TransitionGeometry.ts'

/** Timber portals, boarding, a raised saddle and planks easing a stone passage into a timber room. The passage floor stays walkable underneath, and the saddle is a low bump to step over. */
export default function TimberTransition({transition, timber, lining, floor}: {
  /** the planks’ material, with the mirror the planks lay at their surface if it has one */
  floor: Material & {reflectionTarget?: Object3D | null}
  lining: Material
  timber: Material
  transition: PassageTransition
}) {
  const geometry = useDisposable(useMemo(() => new TransitionGeometry(transition), [transition]))
  const collision = [geometry.timber, geometry.lining].map(colliderGeometry)
  const reflection = floor.reflectionTarget
  return <group name={`${transition.passage.id}-timber-transition`}>
    <RigidBody colliders={false} type='fixed'>
      {collision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
      <ConvexHullCollider args={[geometry.sill.getAttribute('position').array]} />
      <mesh castShadow geometry={geometry.timber} material={timber} name='transition-timber' receiveShadow />
      <mesh castShadow geometry={geometry.lining} material={lining} name='transition-boarding' receiveShadow />
      <mesh castShadow geometry={geometry.sill} material={timber} name='transition-sill' receiveShadow />
    </RigidBody>
    <mesh geometry={geometry.planks} material={floor} name='transition-planks' receiveShadow>
      {/* The planks are laid in world space, their top on the passage’s floor. */}
      <Branch if={reflection}><group position-y={transition.passage.floorY} rotation-x={-Math.PI / 2}><primitive object={reflection!} /></group></Branch>
    </mesh>
  </group>
}
