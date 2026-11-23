import {CuboidCollider, RigidBody} from '@react-three/rapier'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {galleryStairs, moonfallStairs, stairRoofs} from '#src/lib/gallery/staircase.ts'

/** The two straight stairways of the Antechamber: down from the west wing to Moonfall and up from the east wing to the gallery. */
export default function GalleryStairs({moonfall = true, gallery = true}: {
  gallery?: boolean
  moonfall?: boolean
}) {
  return <>
    {moonfall && <StaticBatch name='moonfall-stairway' userData={{room: 'moonfall'}}>
      <RigidBody colliders={false} type='fixed'>
        {moonfallStairs.blocks.map(({position, size}, i) => <group key={i}>
          <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
          <Box color={moonfallTheme.stairway} envMapIntensity={0} name={`stair-block-${i}`} position={position} roughness={0.9} size={size} />
        </group>)}
        <CuboidCollider args={[stairRoofs[0].size[0] / 2, stairRoofs[0].size[1] / 2, stairRoofs[0].size[2] / 2]} position={stairRoofs[0].position} rotation={stairRoofs[0].rotation} />
        <Box name='stairway-ceiling' {...stairRoofs[0]} color={moonfallTheme.stairwayCeiling} envMapIntensity={0} />
      </RigidBody>
      {moonfallStairs.blocks.filter(block => block.tread).map(({axis, position, size, top, direction}, i) => {
        const along = axis === 2 ? 2 : 0
        const strip: [number, number, number] = [0, top - position[1] + 0.004, 0]
        strip[along] = -direction * (size[along] / 2 - 0.035)
        const stripSize: [number, number, number] = [0.025, 0.008, 0.025]
        stripSize[2 - along] = size[2 - along] - 0.45
        return <mesh key={i} position={[position[0] + strip[0], position[1] + strip[1], position[2] + strip[2]]}>
          <boxGeometry args={stripSize} />
          <meshBasicNodeMaterial color={i % 3 === 0 ? '#d5ad73' : moonfallTheme.stepLight} toneMapped={false} />
        </mesh>
      })}
    </StaticBatch>}
    {gallery && <StaticBatch name='antechamber-gallery-stairway' userData={{room: 'antechamber'}}>
      <RigidBody colliders={false} type='fixed'>
        {galleryStairs.blocks.map(({position, size}, i) => <group key={i}>
          <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
          <Box color='#d8d0c2' envMapIntensity={0} name={`gallery-stair-block-${i}`} position={position} roughness={0.9} size={size} />
        </group>)}
        <CuboidCollider args={[stairRoofs[1].size[0] / 2, stairRoofs[1].size[1] / 2, stairRoofs[1].size[2] / 2]} position={stairRoofs[1].position} rotation={stairRoofs[1].rotation} />
        <Box name='gallery-stairway-ceiling' {...stairRoofs[1]} color='#e1dccc' envMapIntensity={0} />
      </RigidBody>
      {galleryStairs.blocks.filter(block => block.tread).map(({position, size, top, direction}, i) => <mesh key={i} position={[position[0] - direction * (size[0] / 2 - 0.035), top + 0.004, position[2]]}>
        <boxGeometry args={[0.025, 0.008, size[2] - 0.45]} />
        <meshBasicNodeMaterial color='#d5ad73' toneMapped={false} />
      </mesh>)}
    </StaticBatch>}
  </>
}
