import type {Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {antechamberAnnexes, antechamberWings, upperGalleryStair} from '#src/lib/gallery/antechamber.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'

import {antechamberFixtures} from '../../lamps.ts'
import Joinery from './Joinery.tsx'

const bronze = '#9c7443'
const slate = '#405e60'
const stair = upperGalleryStair
const roof = stair.beam(stair.headroom, 0.18, stair.width)
const stairGrade = Math.atan(stair.slope)

/** Slabs, the rise to the upper hall and all the fittings beyond the stained-glass rotunda. */
export default function Annexes({stone}: {stone: Texture}) {
  return <group name='antechamber-annexes'>
    <StaticBatch name='annex-stonework'>
      <RigidBody colliders={false} type='fixed'>
        {antechamberAnnexes.map(({center: [x, z], size: [width, depth], ceiling, floorY}, i) => <group key={i}>
          <CuboidCollider args={[width / 2, floorThickness / 2, depth / 2]} position={[x, floorY - floorThickness / 2, z]} />
          <Box color={floorY ? '#ded6b8' : '#c6bb9e'} map={stone} position={[x, floorY - floorThickness / 2, z]} size={[width, floorThickness, depth]} />
          <CuboidCollider args={[width / 2, 0.09, depth / 2]} position={[x, ceiling + 0.09, z]} />
          <Box color='#b8ab91' position={[x, ceiling + 0.09, z]} size={[width, 0.18, depth]} />
        </group>)}
        {stair.blocks.map(({position, size, top, tread}, i) => <group key={i}>
          <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
          <Box color='#c6bb9e' map={stone} position={position} size={size} />
          {tread && <Box color={bronze} metalness={0.56} position={[position[0] + size[0] / 2 - 0.045, top + 0.002, position[2]]} size={[0.028, 0.004, size[2] - 0.34]} />}
        </group>)}
        <CuboidCollider args={[roof.size[0] / 2, roof.size[1] / 2, roof.size[2] / 2]} position={roof.position} rotation={roof.rotation} />
        <Box {...roof} color='#b8ab91' />
        {[-1, 1].map(side => {
          const rail = stair.beam(1.04, 0.065, 0.07, side * (stair.width / 2 - 0.24))
          return <group key={side}>
            <CuboidCollider args={[rail.size[0] / 2, rail.size[1] / 2, rail.size[2] / 2]} position={rail.position} rotation={rail.rotation} />
            <Box {...rail} color={bronze} metalness={0.62} roughness={0.38} />
            {Array.from({length: 7}, (_, i) => <Box key={i} color={bronze} metalness={0.55} position={[rail.position[0] + (i - 3) * 1.5, rail.position[1] + (i - 3) * 1.5 * Math.tan(stairGrade) - 0.12, rail.position[2] + side * 0.07]} size={[0.05, 0.25, 0.2]} />)}
          </group>
        })}
      </RigidBody>
      {Object.entries(antechamberWings).map(([side, {center: [x, z], size: [width, depth]}]) => <group key={side} position={[x, 0, z]}>
        {/* Angled brass keys and colored stone field, flush enough for rolling objects. */}
        <Box color={slate} map={stone} position={[0, 0.001, 0]} rotation={[0, Math.PI / 4, 0]} size={[2.8, 0.004, 2.8]} />
        <Box color={bronze} metalness={0.45} position={[0, 0.003, 0]} rotation={[0, Math.PI / 4, 0]} size={[2.28, 0.004, 2.28]} />
        <Box color='#c6bb9e' map={stone} position={[0, 0.005, 0]} rotation={[0, Math.PI / 4, 0]} size={[2.2, 0.004, 2.2]} />
        <Box color={slate} position={[0, 0.007, 0]} rotation={[0, Math.PI / 4, 0]} size={[0.34, 0.004, 0.34]} />
        {[-1, 1].map(sign => <group key={sign}>
          <Box color={bronze} metalness={0.5} position={[sign * (width / 2 - 0.55), 0.003, 0]} size={[0.021, 0.004, depth - 1.1]} />
          <Box color={bronze} metalness={0.5} position={[0, 0.003, sign * (depth / 2 - 0.55)]} size={[width - 1.121, 0.004, 0.021]} />
        </group>)}
      </group>)}
    </StaticBatch>
    <Joinery />
    <StaticBatch name='annex-lanterns'>
      {Object.entries(antechamberFixtures).map(([id, location]) => <OpalLantern key={id} cool={id.startsWith('descent_')} large={id === 'west' || id === 'east'} position={location} rotation={id === 'stair' ? stairGrade : 0} />)}
    </StaticBatch>
  </group>
}

function OpalLantern({position, large, cool, rotation}: {
  cool: boolean
  large: boolean
  position: readonly [number, number, number]
  rotation: number
}) {
  const radius = large ? 0.47 : 0.22
  const drop = large ? 0.44 : 0.12
  return <group position={position} rotation={[0, 0, rotation]}>
    <mesh position={[0, -0.038, 0]} receiveShadow>
      <cylinderGeometry args={[radius * 1.28, radius * 1.12, 0.077, 32]} />
      <meshStandardNodeMaterial color={bronze} metalness={0.58} roughness={0.46} />
    </mesh>
    <mesh castShadow position={[0, -drop / 2, 0]}>
      <cylinderGeometry args={[0.09, 0.06, drop, 16]} />
      <meshStandardNodeMaterial color={bronze} metalness={0.64} roughness={0.36} />
    </mesh>
    <mesh position={[0, -drop, 0]} scale={[radius, radius * 0.47, radius]}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicNodeMaterial color={cool ? '#c4e5d6' : '#f5d9a7'} toneMapped={false} />
    </mesh>
    {[0, Math.PI / 3, 2 * Math.PI / 3].map(angle => <mesh key={angle} position={[0, -drop, 0]} rotation={[0, angle, 0]} scale={[radius, radius * 0.49, radius]}>
      <torusGeometry args={[1.015, large ? 0.037 : 0.055, 8, 32]} />
      <meshStandardNodeMaterial color={bronze} metalness={0.64} roughness={0.36} />
    </mesh>)}
  </group>
}
