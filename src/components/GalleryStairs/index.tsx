import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {stairBlocks, stairRailGeometry, stairRoofs, stairTurn} from '#src/lib/gallery/staircase.ts'

export default function GalleryStairs() {
  const turnResource = useDisposable(useMemo(() => {
    const parts = [
      {
        name: 'landing',
        geometry: stairTurn.floorGeometry(),
        color: moonfallTheme.stairway,
        roughness: 0.9,
      },
      {
        name: 'ceiling',
        geometry: stairTurn.roofGeometry(),
        color: moonfallTheme.stairwayCeiling,
        roughness: 0.9,
      },
      ...(['inner', 'outer'] as const).map(side => ({
        name: `handrail-${side}`,
        geometry: stairRailGeometry(side),
        color: hsl.integer(79, 48, 60),
        roughness: 0.45,
      })),
    ].map(part => ({
      ...part,
      collision: colliderGeometry(part.geometry),
    }))
    return {
      parts,
      dispose() {
        for (const part of parts) {
          part.geometry.dispose()
        }
      },
    }
  }, []))
  const {parts: turn} = turnResource
  // Moonfall’s fence and walls take in the stairway, so Moonfall owns its steps too.
  return <StaticBatch name='moonfall-stairway' userData={{room: 'moonfall'}}>
    <RigidBody colliders={false} type='fixed'>
      {stairBlocks.map(({position, size}, i) => <group key={i}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
        <Box color={moonfallTheme.stairway} envMapIntensity={0} name={`stair-block-${i}`} position={position} roughness={0.9} size={size} />
      </group>)}
    </RigidBody>
    <RigidBody colliders={false} type='fixed'>
      {turn.map(part => <group key={part.name}>
        <MeshSurfaceCollider args={part.collision} />
        <mesh castShadow geometry={part.geometry} name={`stairway-round-${part.name}`} receiveShadow>
          <meshStandardNodeMaterial color={part.color} envMapIntensity={part.name.startsWith('handrail') ? 1 : 0} metalness={part.name.startsWith('handrail') ? 0.65 : 0} roughness={part.roughness} />
        </mesh>
      </group>)}
    </RigidBody>
    {stairBlocks.filter(block => block.tread).map(({position, size, top, direction}, i) => <mesh key={i} position={[position[0] - direction * (size[0] / 2 - 0.035), top + 0.004, position[2]]}>
      <boxGeometry args={[0.025, 0.008, size[2] - 0.45]} />
      <meshBasicNodeMaterial color={i % 3 === 0 ? hsl.integer(76, 54, 73) : moonfallTheme.stepLight} toneMapped={false} />
    </mesh>)}
    {/* StaticBatch hides the originals before automatic colliders would see them, so the beams state their colliders. */}
    <RigidBody colliders={false} type='fixed'>
      {stairRoofs.map((beam, i) => <group key={i}>
        <CuboidCollider args={[beam.size[0] / 2, beam.size[1] / 2, beam.size[2] / 2]} position={beam.position} rotation={beam.rotation} />
        <Box name='stairway-ceiling' {...beam} color={moonfallTheme.stairwayCeiling} envMapIntensity={0} />
      </group>)}
    </RigidBody>
  </StaticBatch>
}
