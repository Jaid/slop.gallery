import type {Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import {Shape} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {eastStair, stairHallHeight, stairHalls} from '#src/lib/gallery/antechamber.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'

const brass = '#b49356'
const enamel = '#244653'
const brassFinish = {
  color: brass,
  metalness: 0.62,
  roughness: 0.38,
}
const roof = eastStair.beam(eastStair.headroom, 0.18, eastStair.width)
const graduations = Array.from({length: 32}, (_, i) => i * Math.PI / 16)
// Both circles pass through the horns. Unlike a pair of overlapping disks, the cut surface between them really is the blue stone of the field.
const crescent = new Shape
crescent.absarc(0, 0, 0.66, Math.PI / 3, 5 * Math.PI / 3, false)
crescent.absarc(0.66, 0, 0.66, 4 * Math.PI / 3, 2 * Math.PI / 3, true)
/** All coordinates here are in the gallery’s frame, including the raking roof and its collider. */
export default function StairHalls({stone}: {stone: Texture}) {
  return <StaticBatch name='antechamber-stair-halls'>
    {Object.entries(stairHalls).map(([id, {center: [x, z], size: [w, d]}]) => <group key={id} position={[x, 0, z]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[w / 2, floorThickness / 2, d / 2]} position={[0, -floorThickness / 2, 0]} />
        <CuboidCollider args={[w / 2, 0.09, d / 2]} position={[0, stairHallHeight, 0]} />
        <Box color='#e7dfca' map={stone} position={[0, -floorThickness / 2, 0]} size={[w, floorThickness, d]} />
        <Box color='#e4dac6' position={[0, stairHallHeight, 0]} size={[w, 0.18, d]} />
      </RigidBody>
      <Branch if={id !== 'return'}><Lantern /><PavementBorder width={w} /><Dial west={id === 'west'} /></Branch>
    </group>)}
    <RigidBody colliders={false} type='fixed'>
      {eastStair.blocks.map(({position, size, top, tread}, i) => <group key={i}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
        <Box color='#b8ab92' map={stone} name='east-stair-block' position={position} size={size} />
        <Branch if={tread}><Box {...brassFinish} position={[position[0] - size[0] / 2 + 0.042, top, position[2]]} size={[0.02, 0.004, size[2] - 0.34]} /></Branch>
      </group>)}
      <CuboidCollider args={[roof.size[0] / 2, roof.size[1] / 2, roof.size[2] / 2]} position={roof.position} rotation={roof.rotation} />
      <Box {...roof} color='#ded3b9' />
      {[-1, 1].map(side => {
        const rail = eastStair.beam(0.98, 0.075, 0.09, side * (eastStair.width / 2 - 0.19))
        return <group key={side}>
          <CuboidCollider args={[rail.size[0] / 2, rail.size[1] / 2, rail.size[2] / 2]} position={rail.position} rotation={rail.rotation} />
          <Box {...rail} {...brassFinish} />
          {[0.08, 0.36, 0.64, 0.92].map(t => <Box key={t} {...brassFinish} position={[eastStair.start[0] - t * eastStair.length, eastStair.start[1] * (1 - t) + 0.95, rail.position[2] - side * 0.065]} size={[0.06, 0.07, 0.13]} />)}
        </group>
      })}
    </RigidBody>
  </StaticBatch>
}
/** Matched pavement roundels: an engraved sun in the rising hall and a crescent in the descending one. */
function Dial({west}: {west: boolean}) {
  return <group name={west ? 'lunar-dial' : 'solar-dial'}>
    <mesh position-y={0.001} receiveShadow><cylinderGeometry args={[1.36, 1.36, 0.01, 96]} /><meshStandardNodeMaterial color={enamel} roughness={0.38} /></mesh>
    <group position-y={0.007} rotation-x={-Math.PI / 2}>
      {[1.32, 1.12, 0.94].map((r, i) => <mesh key={r} receiveShadow><ringGeometry args={[r - (i === 0 ? 0.035 : 0.012), r, 96]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>)}
      {graduations.map((angle, i) => <group key={angle} rotation-z={angle}>
        <mesh position-y={1.19} receiveShadow><planeGeometry args={[i % 4 ? 0.012 : 0.03, i % 4 ? 0.075 : 0.13]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
      </group>)}
      <Branch if={west}>
        <mesh receiveShadow><shapeGeometry args={[crescent, 40]} /><meshStandardNodeMaterial color='#e0d5b6' roughness={0.35} /></mesh>
        {[[0.45, -0.16, 0.13], [0.14, 0.26, 0.075], [0.66, 0.28, 0.055]].map(([x, y, r]) => <mesh key={x} position={[x, y, 0]} scale={[0.7, 1, 1]}><circleGeometry args={[r, 4]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>)}
      </Branch>
      <Branch not={west}>
        <mesh receiveShadow><circleGeometry args={[0.47, 64]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
        {graduations.filter((_, i) => !(i % 2)).map((angle, i) => <group key={angle} rotation-z={angle}><mesh position-y={0.67} scale={[0.29, i % 2 ? 0.74 : 1, 1]}><circleGeometry args={[0.17, 4]} /><meshStandardNodeMaterial {...brassFinish} /></mesh></group>)}
      </Branch>
    </group>
  </group>
}
/** Concentric octagonal cornices surround a shallow opal lantern, a smaller echo of the oculus in the main dome. */
function Lantern() {
  return <group position-y={stairHallHeight - 0.12}>
    <mesh><cylinderGeometry args={[2.15, 2.05, 0.12, 8]} /><meshStandardNodeMaterial color='#d6c8a9' /></mesh>
    <mesh position-y={-0.075}><cylinderGeometry args={[2.03, 1.99, 0.055, 8]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
    <mesh position-y={-0.105}><cylinderGeometry args={[1.94, 1.88, 0.06, 8]} /><meshStandardNodeMaterial color={enamel} /></mesh>
    <mesh position-y={-0.15}><cylinderGeometry args={[0.86, 0.81, 0.09, 32]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
    <mesh position-y={-0.19} scale={[0.78, 0.14, 0.78]}><sphereGeometry args={[1, 32, 16]} /><meshStandardNodeMaterial color='#f9edcf' emissive='#ffe2aa' emissiveIntensity={1.3} roughness={0.3} /></mesh>
    {graduations.filter((_, i) => !(i % 4)).map(angle => <group key={angle} rotation-y={angle}><Box {...brassFinish} position={[0, -0.14, 1.28]} size={[0.025, 0.018, 0.89]} /></group>)}
  </group>
}
/** A double rule of blue stone and brass frames each dial. Butt the four strips at their corners instead of stacking their faces. */
function PavementBorder({width}: {width: number}) {
  return [0.055, 0.014].map((band, i) => {
    const span = width - 2 * (0.46 + i * 0.11)
    return [-1, 1].map(side => <group key={`${i}-${side}`}>
      <Box color={i ? brass : enamel} position={[side * (span - band) / 2, 0.001, 0]} size={[band, 0.002, span]} />
      <Box color={i ? brass : enamel} position={[0, 0.001, side * (span - band) / 2]} size={[span - 2 * band, 0.002, band]} />
    </group>)
  })
}
