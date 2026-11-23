import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import Chandelier from '#component/Chandelier'
import SiennaWainscot from '#component/SiennaWainscot'
import Box from '#src/components/Scene/primitives.tsx'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {siennaCeilingBeam, siennaCeilingBeamOffsets, siennaCeilingBeamY, siennaCeilingPlanks, siennaRugSize, siennaRugThickness, siennaVestibule, siennaVestibuleCeiling} from '#src/lib/gallery/sienna.ts'
import rugFringeGeometry from '#src/lib/gallery/sienna/RugFringeGeometry.ts'
import PersianRugMaterial from '#src/lib/materials/PersianRugMaterial.ts'
import PlankFloorMaterial from '#src/lib/materials/PlankFloorMaterial.ts'
import PlankMaterial from '#src/lib/materials/PlankMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('sienna')

/** The Sienna’s floor, rug, beams, wainscot and chandelier, and its vestibule’s floor, ceiling and joists; its papered walls and their trim come from the shared wall surfaces. */
export default function SiennaRoom({joinery}: {
  /** dark wood with its grain along each mesh’s x axis (varnished, shared with the walls’ trim) and z axis (oiled, for the joists) */
  joinery: {
    /** the darker raised fields of the wainscot */
    panel: Material
    x: Material
    z: Material
  }
}) {
  const {mirrorReflections} = useGraphicsModeValue(getGraphicsProfile)
  // The planks blur a reflection to a faint smear, not worth a mirrored pass of the scene.
  const floor = useDisposable(useMemo(() => new PlankFloorMaterial(undefined, false), []))
  const ceiling = useDisposable(useMemo(() => new PlankMaterial(siennaCeilingPlanks), []))
  const rug = useDisposable(useMemo(() => new PersianRugMaterial(siennaRugSize), []))
  const fringe = useDisposable(useMemo(() => rugFringeGeometry(...siennaRugSize), []))
  const reflection = floor.reflectionTarget
  const [vestibuleWidth, vestibuleDepth] = siennaVestibule.size
  return <>
    <group name='sienna-room' position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[room.size[0] / 2, floorThickness / 2, room.size[1] / 2]} position={[0, -floorThickness / 2, 0]} />
        <CuboidCollider args={[room.size[0] / 2, 0.15, room.size[1] / 2]} position={[0, 5.9, 0]} />
        <Box color='#392517' envMapIntensity={mirrorReflections ? 1 : 0} name='sienna-floor-slab' position={[0, -floorThickness / 2, 0]} size={[room.size[0], floorThickness, room.size[1]]} />
        <Box material={ceiling} name='sienna-ceiling' position={[0, 5.78, 0]} size={[room.size[0], 0.18, room.size[1]]} />
      </RigidBody>
      <mesh name='sienna-wood-floor' position={[0, 0.001, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[...room.size]} />
        <primitive attach='material' object={floor} />
        <Branch if={reflection}><primitive object={reflection!} /></Branch>
      </mesh>
      {siennaCeilingBeamOffsets(room.size[0]).map(x => <Box key={x} material={joinery.z} name='sienna-ceiling-beam' position={[x, siennaCeilingBeamY(room.height), 0]} size={[siennaCeilingBeam.width, siennaCeilingBeam.height, room.size[1]]} />)}
      <mesh material={rug} name='sienna-carpet' position={[0, siennaRugThickness / 2, 0]} receiveShadow>
        <boxGeometry args={[siennaRugSize[0], siennaRugThickness, siennaRugSize[1]]} />
      </mesh>
      <mesh geometry={fringe} name='sienna-carpet-fringe' position={[0, 0.004, 0]} receiveShadow>
        <meshStandardNodeMaterial color='#b9a888' roughness={0.92} />
      </mesh>
      <Chandelier lamp='sienna-chandelier' />
    </group>
    <group name='sienna-vestibule' position={[siennaVestibule.center[0], 0, siennaVestibule.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[vestibuleWidth / 2, floorThickness / 2, vestibuleDepth / 2]} position={[0, -floorThickness / 2, 0]} />
        <CuboidCollider args={[vestibuleWidth / 2, siennaVestibuleCeiling.thickness / 2, vestibuleDepth / 2]} position={[0, siennaVestibuleCeiling.y, 0]} />
        <Box color='#392517' envMapIntensity={mirrorReflections ? 1 : 0} name='sienna-vestibule-floor-slab' position={[0, -floorThickness / 2, 0]} size={[vestibuleWidth, floorThickness, vestibuleDepth]} />
        <Box material={ceiling} name='sienna-vestibule-ceiling' position={[0, siennaVestibuleCeiling.y, 0]} size={[vestibuleWidth, siennaVestibuleCeiling.thickness, vestibuleDepth]} />
      </RigidBody>
      <mesh name='sienna-vestibule-wood-floor' position={[0, 0.001, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[vestibuleWidth, vestibuleDepth]} />
        <primitive attach='material' object={floor} />
      </mesh>
      {siennaCeilingBeamOffsets(vestibuleWidth, 2).map(x => <Box key={x} material={joinery.z} name='sienna-vestibule-ceiling-beam' position={[x, siennaCeilingBeamY(siennaVestibule.height), 0]} size={[siennaCeilingBeam.width, siennaCeilingBeam.height, vestibuleDepth]} />)}
    </group>
    {slopGallery.walls.filter(wall => wall.room === 'sienna').map(wall => <SiennaWainscot key={wall.id} field={joinery.panel} frame={joinery.x} wall={wall} />)}
  </>
}
