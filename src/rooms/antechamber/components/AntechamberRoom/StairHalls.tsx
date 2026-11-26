import type {Vec3} from '#src/lib/gallery/types.ts'
import type {PlanarReflection} from '#src/lib/materials/PlanarMirrorMaterial.ts'
import type {Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {Shape} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {antechamberLanding, antechamberLandingSlab, antechamberStairBlocks, antechamberStairs, stairHallHeight, stairHalls} from '#src/lib/gallery/antechamber.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import PlanarMirrorMaterial from '#src/lib/materials/PlanarMirrorMaterial.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

const {mirrorReflections} = graphicsProfile
const brass = hsl.integer(82, 54, 63)
const enamel = hsl.integer(225, 46, 28)
/** the moon’s figures, in the hue of the lunar hall’s lamp */
const lunarSilver = hsl.integer(246, 21, 83)
const stairStone = hsl.integer(84, 22, 70)
const stairCeiling = hsl.integer(88, 32, 85)
const brassFinish = {
  color: brass,
  metalness: 0.62,
  roughness: 0.38,
}
/** how the figures in the middle of the dials mirror the hall in heavy mode: sharp and from every angle alike, a fifth of their own finish still showing through */
const figureMirror: PlanarReflection = {
  strength: 0.8,
  grazingStrength: 0,
  loss: 0,
}
const flight = antechamberStairs
const roof = flight.beam(flight.headroom, 0.18, flight.width)
const graduations = Array.from({length: 32}, (_, i) => i * Math.PI / 16)
// Both circles pass through the horns. Unlike a pair of overlapping disks, the cut surface between them really is the blue stone of the field.
const crescent = new Shape
crescent.absarc(0, 0, 0.66, Math.PI / 3, 5 * Math.PI / 3, false)
crescent.absarc(0.66, 0, 0.66, 4 * Math.PI / 3, 2 * Math.PI / 3, true)
const [landingX, landingZ] = antechamberLanding.center
const [landingWidth, landingDepth] = antechamberLanding.size
const landingFloor: {
  position: Vec3
  size: Vec3
} = {
  position: [landingX, antechamberLanding.floorY - antechamberLandingSlab.floor / 2, landingZ],
  size: [landingWidth, antechamberLandingSlab.floor, landingDepth],
}
const landingCeiling: typeof landingFloor = {
  position: [landingX, antechamberLanding.floorY + antechamberLanding.height, landingZ],
  size: [landingWidth, antechamberLandingSlab.ceiling, landingDepth],
}
/** The point `t` of the way along the flight from its head to its foot, `across` meters right of its center line and `height` meters over its grade, the way {@link StairFlight.beam} lays out its beams. */
function onFlight(t: number, across: number, height: number): Vec3 {
  const [hx, hz] = flight.heading
  return [flight.start[0] + hx * t * flight.length - hz * across, flight.start[1] + (flight.end[1] - flight.start[1]) * t + height, flight.start[2] + hz * t * flight.length + hx * across]
}
/** the size of a box `along` meters long along the flight and `across` meters across it */
const alongFlight = (along: number, height: number, across: number): Vec3 => (flight.axis === 2 ? [across, height, along] : [along, height, across])
/** All coordinates here are in the gallery’s frame, including the raking roof and its collider. */
export default function StairHalls({stone}: {stone: Texture}) {
  return <StaticBatch name='antechamber-stair-halls'>
    {Object.entries(stairHalls).map(([id, {center: [x, z], size: [w, d]}]) => <group key={id} position={[x, 0, z]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[w / 2, floorThickness / 2, d / 2]} position={[0, -floorThickness / 2, 0]} />
        <CuboidCollider args={[w / 2, 0.09, d / 2]} position={[0, stairHallHeight, 0]} />
        <Box color={hsl.integer(90, 33, 89)} map={stone} position={[0, -floorThickness / 2, 0]} size={[w, floorThickness, d]} />
        <Box color={hsl.integer(85, 30, 87)} position={[0, stairHallHeight, 0]} size={[w, 0.18, d]} />
      </RigidBody>
      <Lantern />
      <PavementBorder width={w} />
      <Dial lunar={id === 'east'} />
    </group>)}
    <RigidBody colliders={false} type='fixed'>
      {antechamberStairBlocks.map(({axis = 0, direction, position, size, top, tread}, i) => <group key={i}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
        <Box color={stairStone} map={stone} name='antechamber-stair-block' position={position} size={size} />
        {/* A brass strip along the nosing of every tread, the edge toward the foot of the flight. */}
        <Branch if={tread}><Box {...brassFinish} position={axis === 0 ? [position[0] + direction * (size[0] / 2 - 0.042), top, position[2]] : [position[0], top, position[2] + direction * (size[2] / 2 - 0.042)]} size={alongFlight(0.02, 0.004, flight.width - 0.34)} /></Branch>
      </group>)}
      <CuboidCollider args={[roof.size[0] / 2, roof.size[1] / 2, roof.size[2] / 2]} position={roof.position} rotation={roof.rotation} />
      <Box {...roof} color={stairCeiling} />
      <CuboidCollider args={[landingFloor.size[0] / 2, landingFloor.size[1] / 2, landingFloor.size[2] / 2]} position={landingFloor.position} />
      <Box {...landingFloor} color={stairStone} map={stone} name='antechamber-landing' />
      <CuboidCollider args={[landingCeiling.size[0] / 2, landingCeiling.size[1] / 2, landingCeiling.size[2] / 2]} position={landingCeiling.position} />
      <Box {...landingCeiling} color={stairCeiling} name='antechamber-landing-ceiling' />
      {[-1, 1].map(side => {
        const rail = flight.beam(0.98, 0.075, 0.09, side * (flight.width / 2 - 0.19))
        return <group key={side}>
          <CuboidCollider args={[rail.size[0] / 2, rail.size[1] / 2, rail.size[2] / 2]} position={rail.position} rotation={rail.rotation} />
          <Box {...rail} {...brassFinish} />
          {/* Brackets from the rail back to its wall. */}
          {[0.08, 0.36, 0.64, 0.92].map(t => <Box key={t} {...brassFinish} position={onFlight(t, side * (flight.width / 2 - 0.125), 0.95)} size={alongFlight(0.06, 0.07, 0.13)} />)}
        </group>
      })}
    </RigidBody>
  </StaticBatch>
}
/** Matched pavement roundels: a crescent in the hall down to Moonfall and an engraved sun in the one rising toward the floor above. */
function Dial({lunar}: {lunar: boolean}) {
  return <group name={lunar ? 'lunar-dial' : 'solar-dial'}>
    <mesh position-y={0.001} receiveShadow><cylinderGeometry args={[1.36, 1.36, 0.01, 96]} /><meshStandardNodeMaterial color={enamel} roughness={0.38} /></mesh>
    <group position-y={0.007} rotation-x={-Math.PI / 2}>
      {[1.32, 1.12, 0.94].map((r, i) => <mesh key={r} receiveShadow><ringGeometry args={[r - (i === 0 ? 0.035 : 0.012), r, 96]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>)}
      {graduations.map((angle, i) => <group key={angle} rotation-z={angle}>
        <mesh position-y={1.19} receiveShadow><planeGeometry args={[i % 4 ? 0.012 : 0.03, i % 4 ? 0.075 : 0.13]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
      </group>)}
      <Branch if={lunar} then={Moon} />
      <Branch not={lunar} then={Sun} />
    </group>
  </group>
}
/** A material for the figures in the middle of a dial: mirroring in heavy mode, which sets aside the metal of the brass ones, and as before otherwise. */
function useFigureMaterial(color: number, roughness: number, metalness = 0) {
  return useDisposable(useMemo(() => {
    const material = new PlanarMirrorMaterial(null, {
      color,
      roughness,
      reflection: mirrorReflections ? figureMirror : undefined,
    })
    if (!mirrorReflections) {
      material.metalness = metalness
    }
    return material
  }, [color, metalness, roughness]))
}
/** The crescent and its three stars in one bluish silver, laid in the dial’s plane like the reflection target of their mirror. */
function Moon() {
  const silver = useFigureMaterial(lunarSilver, brassFinish.roughness, brassFinish.metalness)
  return <>
    <mesh material={silver} receiveShadow><shapeGeometry args={[crescent, 40]} /></mesh>
    {[[0.45, -0.16, 0.13], [0.14, 0.26, 0.075], [0.66, 0.28, 0.055]].map(([x, y, r]) => <mesh key={x} material={silver} position={[x, y, 0]} scale={[0.7, 1, 1]}><circleGeometry args={[r, 4]} /></mesh>)}
    <Branch if={silver.reflectionTarget}><primitive object={silver.reflectionTarget!} /></Branch>
  </>
}
/** The sun and its rays, laid in the dial’s plane like the reflection target of their mirror. */
function Sun() {
  const gold = useFigureMaterial(brass, brassFinish.roughness, brassFinish.metalness)
  return <>
    <mesh material={gold} receiveShadow><circleGeometry args={[0.47, 64]} /></mesh>
    {graduations.filter((_, i) => !(i % 2)).map((angle, i) => <group key={angle} rotation-z={angle}><mesh material={gold} position-y={0.67} scale={[0.29, i % 2 ? 0.74 : 1, 1]}><circleGeometry args={[0.17, 4]} /></mesh></group>)}
    <Branch if={gold.reflectionTarget}><primitive object={gold.reflectionTarget!} /></Branch>
  </>
}
/** Concentric octagonal cornices surround a shallow opal lantern, a smaller echo of the oculus in the main dome. */
function Lantern() {
  return <group position-y={stairHallHeight - 0.12}>
    <mesh><cylinderGeometry args={[2.15, 2.05, 0.12, 8]} /><meshStandardNodeMaterial color={hsl.integer(87, 33, 81)} /></mesh>
    <mesh position-y={-0.075}><cylinderGeometry args={[2.03, 1.99, 0.055, 8]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
    <mesh position-y={-0.105}><cylinderGeometry args={[1.94, 1.88, 0.06, 8]} /><meshStandardNodeMaterial color={enamel} /></mesh>
    <mesh position-y={-0.15}><cylinderGeometry args={[0.86, 0.81, 0.09, 32]} /><meshStandardNodeMaterial {...brassFinish} /></mesh>
    <mesh position-y={-0.19} scale={[0.78, 0.14, 0.78]}><sphereGeometry args={[1, 32, 16]} /><meshStandardNodeMaterial color={hsl.integer(89, 68, 94)} emissive={hsl.integer(83, 100, 91)} emissiveIntensity={1.3} roughness={0.3} /></mesh>
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
